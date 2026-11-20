import type { ReactNode } from "react";
import { Rating } from "@/lib/rating-scale";
import { formatHours, type CollectionStats } from "@/app/(app)/films/home-data";

export type StatItem = {
  label: string;
  value: ReactNode;
  delta: string;
  tone: "up" | "down" | "flat";
};

export function delta(value: number, suffix = "", decimals = 0): Pick<StatItem, "delta" | "tone"> {
  if (value === 0) return { delta: "= stable", tone: "flat" };
  const up = value > 0;
  return {
    delta: `${up ? "+" : "−"}${Math.abs(value).toFixed(decimals)}${suffix}`,
    tone: up ? "up" : "down",
  };
}

/** Les quatre chiffres de l'accueil, mis en forme une fois pour les trois maquettes. */
export function statItems(s: CollectionStats): StatItem[] {
  return [
    { label: "Films notés", value: s.count, ...delta(s.deltaFilms, " ce mois") },
    { label: "Note moyenne", value: <Rating value={s.avgRating} />, ...delta(s.deltaRating, "", 1) },
    {
      label: "Heures cumulées",
     
      value: s.totalMinutes > 0 ? formatHours(s.totalMinutes) : "—",
      ...delta(s.deltaHours, "h", 1),
    },
    { label: "Films ce mois", value: s.filmsCeMois, ...delta(s.deltaWeeklyFilms, " cette sem.") },
  ];
}
