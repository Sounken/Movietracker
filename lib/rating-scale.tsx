"use client";

import { createContext, useContext } from "react";
import { DEFAULT_RATING_SCALE, formatRating, type RatingScale } from "./rating";

/**
 * L'échelle choisie par l'utilisateur est fournie une seule fois par les
 * layouts. Sans ça il faudrait la passer en prop à la vingtaine d'endroits
 * qui affichent une note.
 */
const RatingScaleContext = createContext<RatingScale>(DEFAULT_RATING_SCALE);

export function RatingScaleProvider({
  scale,
  children,
}: {
  scale: RatingScale;
  children: React.ReactNode;
}) {
  return <RatingScaleContext value={scale}>{children}</RatingScaleContext>;
}

export function useRatingScale(): RatingScale {
  return useContext(RatingScaleContext);
}

/**
 * Affiche une note stockée (sur 10) dans l'échelle de l'utilisateur.
 * Rendu sous forme de fragment pour se glisser dans le balisage existant
 * (« ★ <Rating value={…} /> »).
 */
export function Rating({
  value,
  outOf = false,
  fallback = "—",
}: {
  value: number | null | undefined;
  /** Ajoute « /10 » ou « /100 » après la note. */
  outOf?: boolean;
  fallback?: string;
}) {
  const scale = useRatingScale();
  const text = formatRating(value, scale, fallback);
  return <>{value == null ? text : outOf ? `${text}/${scale}` : text}</>;
}
