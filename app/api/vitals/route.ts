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

  // 204 : le navigateur n'attend rien, et `sendBeacon` ignore la réponse.
  return new NextResponse(null, { status: 204 });
}
