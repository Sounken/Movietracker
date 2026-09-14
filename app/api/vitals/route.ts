import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";
import { normalizeRoute, TRACKED_METRICS } from "@/lib/web-vitals-route";

/**
 * Collecte des Core Web Vitals envoyés par le navigateur.
 *
 * **Seuls les utilisateurs connectés sont enregistrés.** La route était ouverte
 * à tous, au motif que les visiteurs anonymes produisent des mesures aussi
 * utiles que les autres. En pratique, les anonymes étaient un robot : sur les
 * 24 heures mesurées le 2026-09-15, 75 091 lignes, dont une dizaine seulement
 * venues d'une session. Il parcourait les fiches acteur, film et société en
 * exécutant le JavaScript, et chaque page chargée écrivait trois à cinq lignes.
 *
 * Deux coûts en découlaient, sans rapport avec l'intérêt des mesures :
 *  - Neon recevait environ une écriture par seconde et ne se mettait jamais en
 *    veille. Son calcul se facture au temps éveillé : le quota mensuel gratuit
 *    fondait au rythme d'une journée pleine par jour ;
 *  - la table regagnait 190 Mo en neuf jours, sur un plafond de 0,5 Go.
 *
 * Les mesures d'un robot n'apprennent de toute façon rien sur l'expérience des
 * utilisateurs : autre machine, autre réseau, jamais de cache chaud.
 *
 * La session est vérifiée **avant** de lire le corps. `getSession` se contente
 * de déchiffrer un cookie, sans toucher la base : un envoi anonyme coûte
 * quelques microsecondes et ne réveille rien. Le navigateur continue d'envoyer
 * ses mesures quelle que soit la session — le composant est monté dans le
 * layout racine, qui ne peut pas lire les cookies sans rendre dynamiques les
 * pages statiques comme `/login`. Le tri se fait donc ici.
 */

/** Bornes de bon sens. Au-delà, la valeur est une aberration ou une injection. */
const MAX_VALUE = 120_000; // 2 minutes en millisecondes
const VALID_RATINGS = new Set(["good", "needs-improvement", "poor"]);
const VALID_NAVIGATION = new Set(["navigate", "reload", "back-forward", "back_forward", "prerender", "restore"]);

/**
 * Rétention des relevés bruts.
 *
 * La page /vitals n'agrège que les sept derniers jours ; quatorze laissent de
 * la marge pour élargir la fenêtre d'affichage. Au-delà, un relevé individuel
 * n'a aucune valeur : ce qui compte sur la durée, c'est la tendance, et elle
 * demanderait une table d'agrégats quotidiens, pas des lignes brutes.
 */
const RETENTION_DAYS = 14;

/**
 * Intervalle minimal entre deux purges.
 *
 * La purge était tirée au sort, une écriture sur cinq cents : un réglage fait
 * pour des milliers de relevés par jour. Réservée aux sessions, la collecte
 * tombe à quelques dizaines de lignes quotidiennes, et le tirage ne sortirait
 * plus qu'une fois par mois. On purge donc au plus toutes les six heures, à la
 * première écriture qui suit.
 *
 * L'horodatage vit en mémoire du processus : un redémarrage provoque une purge
 * de plus, sans conséquence.
 */
const PURGE_INTERVAL_MS = 6 * 60 * 60 * 1000;
let lastPurgeAt = 0;

async function purgeOldVitals() {
  const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000);
  try {
    const { count } = await prisma.webVital.deleteMany({
      where: { createdAt: { lt: cutoff } },
    });
    if (count > 0) {
      console.log(`[vitals] purge : ${count} relevés de plus de ${RETENTION_DAYS} jours supprimés`);
    }
  } catch (error) {
    // La purge est de l'entretien, pas le service rendu : son échec ne doit
    // pas faire échouer la collecte ni remonter comme un incident.
    console.error("[vitals] purge impossible :", error);
  }
}

export async function POST(request: NextRequest) {
  // 204 plutôt que 401 : le navigateur n'attend rien d'un beacon, et une
  // réponse d'erreur apparaîtrait dans la console de chaque visiteur anonyme.
  const session = await getSession();
  if (!session) return new NextResponse(null, { status: 204 });

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Corps illisible" }, { status: 400 });
  }

  if (typeof payload !== "object" || payload === null) {
    return NextResponse.json({ error: "Corps invalide" }, { status: 400 });
  }

  const { route, metric, value, rating, navigationType } = payload as Record<string, unknown>;

  // La métrique doit faire partie des cinq suivies : c'est ce qui empêche de
  // remplir la table de noms arbitraires.
  if (typeof metric !== "string" || !TRACKED_METRICS.includes(metric as never)) {
    return NextResponse.json({ error: "Métrique inconnue" }, { status: 400 });
  }

  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > MAX_VALUE) {
    return NextResponse.json({ error: "Valeur hors bornes" }, { status: 400 });
  }

  if (typeof rating !== "string" || !VALID_RATINGS.has(rating)) {
    return NextResponse.json({ error: "Verdict invalide" }, { status: 400 });
  }

  if (typeof route !== "string" || route.length > 200) {
    return NextResponse.json({ error: "Route invalide" }, { status: 400 });
  }

  // Le client normalise déjà, mais on repasse la route ici : c'est la seule
  // garantie que rien d'identifiant ne se retrouve stocké, quoi qu'envoie
  // l'appelant.
  const normalizedRoute = normalizeRoute(route);

  const navigation =
    typeof navigationType === "string" && VALID_NAVIGATION.has(navigationType)
      ? navigationType
      : null;

  await prisma.webVital.create({
    data: {
      route: normalizedRoute,
      metric,
      value,
      rating,
      navigationType: navigation,
      userId: session.userId,
    },
  });

  // Horodatage posé avant l'attente, pour que deux relevés simultanés ne
  // lancent pas chacun leur purge. Attendue plutôt que lancée en arrière-plan :
  // une promesse flottante peut être interrompue par la fin de la requête.
  if (Date.now() - lastPurgeAt > PURGE_INTERVAL_MS) {
    lastPurgeAt = Date.now();
    await purgeOldVitals();
  }

  // 204 : le navigateur n'attend rien, et `sendBeacon` ignore la réponse.
  return new NextResponse(null, { status: 204 });
}
