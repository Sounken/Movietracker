"use client";

import { useState, useMemo } from "react";
import FilmGrid from "./FilmGrid";
import type { TmdbFilmCard } from "@/lib/tmdb";
import styles from "./CollectionClient.module.css";

type Film = TmdbFilmCard & { rating: number | null };

const RATINGS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

export default function CollectionClient({ films }: { films: Film[] }) {
  const [minRating, setMinRating] = useState<number | null>(null);
  const [maxRating, setMaxRating] = useState<number | null>(null);
  const [yearFilter, setYearFilter] = useState<string>("");
  const [sortBy, setSortBy] = useState<"recent" | "rating" | "year">("recent");
  const years = useMemo(() => {
    const set = new Set(films.map((f) => f.year).filter(Boolean));
    return Array.from(set).sort((a, b) => Number(b) - Number(a));
  }, [films]);

  const filtered = useMemo(() => {
    let result = [...films];
    if (minRating !== null) result = result.filter((f) => f.rating !== null && f.rating >= minRating);
    if (maxRating !== null) result = result.filter((f) => f.rating !== null && f.rating <= maxRating);
    if (yearFilter) result = result.filter((f) => f.year === yearFilter);
    result.sort((a, b) => {
      if (sortBy === "rating") return (b.rating ?? 0) - (a.rating ?? 0);
      if (sortBy === "year") return Number(b.year) - Number(a.year);
      return 0; // "recent" order preserved from server (updatedAt desc)
    });
    return result;
  }, [films, minRating, maxRating, yearFilter, sortBy]);

  const hasFilters = minRating !== null || maxRating !== null || yearFilter;

  return (
    <>
      <div className={styles.toolbar}>
        <div className={styles.left}>
          <div className={styles.filterGroup}>
            <select
              className={styles.select}
              value={minRating ?? ""}
              onChange={(e) => setMinRating(e.target.value ? Number(e.target.value) : null)}
            >
              <option value="">Note min</option>
              {RATINGS.slice(0, -1).map((r) => (
                <option key={r} value={r}>≥ {r}</option>
              ))}
            </select>
            <select
              className={styles.select}
              value={maxRating ?? ""}
              onChange={(e) => setMaxRating(e.target.value ? Number(e.target.value) : null)}
            >
              <option value="">Note max</option>
              {RATINGS.slice(1).map((r) => (
                <option key={r} value={r}>≤ {r}</option>
              ))}
            </select>
            <select
              className={styles.select}
              value={yearFilter}
              onChange={(e) => setYearFilter(e.target.value)}
            >
              <option value="">Toutes années</option>
              {years.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
            {hasFilters && (
              <button
                className={styles.clearBtn}
                onClick={() => { setMinRating(null); setMaxRating(null); setYearFilter(""); }}
              >
                Effacer
              </button>
            )}
          </div>
        </div>

        <div className={styles.right}>
          {(["recent", "rating", "year"] as const).map((s) => (
            <button
              key={s}
              className={`${styles.sortBtn} ${sortBy === s ? styles.sortOn : ""}`}
              onClick={() => setSortBy(s)}
            >
              {s === "recent" ? "Récents" : s === "rating" ? "Notes" : "Année"}
            </button>
          ))}
        </div>
      </div>

      {hasFilters && filtered.length === 0 ? (
        <div className={styles.noResult}>Aucun film ne correspond à ces filtres.</div>
      ) : (
        <FilmGrid films={filtered} emptyTitle="Vous n'avez encore noté aucun film." emptyHint='Utilisez le bouton "+ Ajouter un film" pour commencer.' />
      )}
    </>
  );
}
