import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";
import { normalizeRoute, TRACKED_METRICS } from "@/lib/web-vitals-route";

/**
 * Collecte des Core Web Vitals envoyés par le navigateur.
 *
 * Route publique par nécessité : les visiteurs non connectés produisent des
 * mesures aussi utiles que les autres. Elle est donc écrite en supposant que
 * n'importe qui peut lui envoyer n'importe quoi.
 */

/** Bornes de bon sens. Au-delà, la valeur est une aberration ou une injection. */
const MAX_VALUE = 120_000; // 2 minutes en millisecondes
const VALID_RATINGS = new Set(["good", "needs-improvement", "poor"]);
const VALID_NAVIGATION = new Set(["navigate", "reload", "back-forward", "back_forward", "prerender", "restore"]);

/**
 * Rétention des relevés bruts.
 *
 * **C'est ce qui manquait, et ça a rempli la base.** Cette route écrit une
 * ligne par métrique et par page vue — cinq par visite — sans que rien ne
 * supprime jamais. La table grossissait donc indéfiniment, au rythme du trafic,
 * pour alimenter une page qui n'agrège que les sept derniers jours.
 *
 * Quatorze jours laissent de la marge pour élargir la fenêtre d'affichage sans
 * rien reperdre, tout en divisant par plusieurs fois ce qui est conservé.
 * Au-delà, un relevé individuel n'a aucune valeur : ce qui compte sur la durée,
 * c'est la tendance, et elle demanderait une table d'agrégats quotidiens, pas
 * des millions de lignes brutes.
 */
const RETENTION_DAYS = 14;

/**
 * Probabilité qu'une écriture déclenche la purge.
 *
 * Faite ici plutôt que dans une tâche planifiée : le serveur est déjà à
 * saturation et n'a pas besoin d'un service de plus. À quelques milliers de
 * relevés par jour, une chance sur cinq cents fait tourner la purge plusieurs
 * fois par jour sans qu'aucune requête ne la porte visiblement, et l'index sur
 * `createdAt` rend la suppression peu coûteuse.
 */
const PURGE_PROBABILITY = 1 / 500;

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

  const session = await getSession();

  await prisma.webVital.create({
    data: {
      route: normalizedRoute,
      metric,
      value,
      rating,
      navigationType: navigation,
      userId: session?.userId ?? null,
    },
  });

  // Attendue plutôt que lancée en arrière-plan : une promesse flottante peut
  // être interrompue par la fin de la requête. À une chance sur cinq cents, le
  // coût moyen par relevé est négligeable, et le navigateur n'attend de toute
  // façon pas la réponse d'un beacon.
  if (Math.random() < PURGE_PROBABILITY) await purgeOldVitals();

  // 204 : le navigateur n'attend rien, et `sendBeacon` ignore la réponse.
  return new NextResponse(null, { status: 204 });
}
