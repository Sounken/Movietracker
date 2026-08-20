/**
 * Échelle d'affichage des notes.
 *
 * Les notes restent **toujours** stockées sur 10 en base (Float, pas de 0.5) :
 * changer d'échelle est purement cosmétique, aucune migration des notes
 * existantes n'est nécessaire et les agrégats Prisma continuent de fonctionner.
 */
export type RatingScale = 10 | 100;

export const DEFAULT_RATING_SCALE: RatingScale = 10;

/** Normalise une valeur venue de la base (Int libre) vers une échelle valide. */
export function toRatingScale(value: number | null | undefined): RatingScale {
  return value === 100 ? 100 : DEFAULT_RATING_SCALE;
}

/** Convertit une note stockée (sur 10) vers l'échelle d'affichage. */
export function toDisplayRating(stored: number, scale: RatingScale): number {
  // L'arrondi évite les 84.99999999 dus au flottant.
  return scale === 100 ? Math.round(stored * 10) : stored;
}

/** Convertit une note saisie dans l'échelle d'affichage vers le stockage (sur 10). */
export function toStoredRating(displayed: number, scale: RatingScale): number {
  return scale === 100 ? Math.round(displayed) / 10 : displayed;
}

/**
 * Formate une note pour l'affichage.
 * Sur 10 on garde une décimale utile (8.5) ; sur 100 on affiche un entier (85).
 */
export function formatRating(
  stored: number | null | undefined,
  scale: RatingScale,
  fallback = "—",
): string {
  if (stored == null) return fallback;
  const value = toDisplayRating(stored, scale);
  if (scale === 100) return String(Math.round(value));
  // 8 → « 8 », 8.5 → « 8.5 » : pas de décimale inutile.
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

/** Idem, suffixé par l'échelle : « 8.5/10 » ou « 85/100 ». */
export function formatRatingOutOf(
  stored: number | null | undefined,
  scale: RatingScale,
  fallback = "—",
): string {
  if (stored == null) return fallback;
  return `${formatRating(stored, scale)}/${scale}`;
}
