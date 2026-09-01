/**
 * Normalisation des chemins en motifs de route.
 *
 * Sans elle, chaque film visité créerait sa propre ligne d'agrégat : on aurait
 * un LCP pour « /film/550 », un autre pour « /film/680 », et aucune moyenne
 * exploitable. On veut savoir si « la fiche film » est lente, pas si le
 * Parrain l'est.
 *
 * Partagée entre le client, qui l'applique avant l'envoi, et la page de
 * visualisation, pour que les deux parlent des mêmes routes.
 */

/** Segments dynamiques : identifiants TMDB, cuid des utilisateurs et listes. */
const DYNAMIC_SEGMENT = /^(\d+|c[a-z0-9]{20,}|[0-9a-f]{8}-[0-9a-f]{4}-)/i;

export function normalizeRoute(pathname: string): string {
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length === 0) return "/";

  const normalized = segments.map((segment) =>
    DYNAMIC_SEGMENT.test(segment) ? "[id]" : segment,
  );

  return "/" + normalized.join("/");
}

/** Les cinq métriques retenues. Tout autre nom est rejeté par la route API. */
export const TRACKED_METRICS = ["LCP", "INP", "CLS", "TTFB", "FCP"] as const;
export type TrackedMetric = (typeof TRACKED_METRICS)[number];

/**
 * Seuils officiels des Core Web Vitals, en millisecondes sauf CLS qui est un
 * score. Repris ici pour colorer la page de visualisation sans avoir à
 * embarquer la bibliothèque côté serveur.
 */
export const THRESHOLDS: Record<TrackedMetric, { good: number; poor: number; unit: string }> = {
  LCP: { good: 2500, poor: 4000, unit: "ms" },
  INP: { good: 200, poor: 500, unit: "ms" },
  CLS: { good: 0.1, poor: 0.25, unit: "" },
  TTFB: { good: 800, poor: 1800, unit: "ms" },
  FCP: { good: 1800, poor: 3000, unit: "ms" },
};
