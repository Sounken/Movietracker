"use client";

import { useState, useMemo, useTransition } from "react";
import FilmGrid from "./FilmGrid";
import type { TmdbFilmCard } from "@/lib/tmdb";
import styles from "./CollectionClient.module.css";
import loadMoreStyles from "./FilmGridInfinite.module.css";

type Film = TmdbFilmCard & { rating: number | null };

const RATINGS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const PAGE_SIZE = 24;

export default function CollectionClient({
  films: initialFilms,
  total,
  type = "rated",
  ratingField = "rating",
  emptyTitle,
  emptyHint,
}: {
  films: Film[];
  total: number;
  type?: "rated" | "watchlist" | "liked" | "all";
  ratingField?: "rating" | "voteAverage";
  emptyTitle?: string;
  emptyHint?: string;
}) {
  const [films, setFilms] = useState<Film[]>(initialFilms);
  const [minRating, setMinRating] = useState<number | null>(null);
  const [maxRating, setMaxRating] = useState<number | null>(null);
  const [yearFilter, setYearFilter] = useState<string>("");
  const [sortBy, setSortBy] = useState<"recent" | "rating" | "year">("recent");
  const [isPending, startTransition] = useTransition();

  const years = useMemo(() => {
    const set = new Set(films.map((f) => f.year).filter(Boolean));
    return Array.from(set).sort((a, b) => Number(b) - Number(a));
  }, [films]);

  const ratingVal = (f: Film) =>
    ratingField === "voteAverage" ? (f.voteAverage ?? 0) : (f.rating ?? 0);

  const filtered = useMemo(() => {
    let result = [...films];
    if (minRating !== null) result = result.filter((f) => ratingVal(f) >= minRating);
    if (maxRating !== null) result = result.filter((f) => ratingVal(f) <= maxRating);
    if (yearFilter) result = result.filter((f) => f.year === yearFilter);
    result.sort((a, b) => {
      if (sortBy === "rating") return ratingVal(b) - ratingVal(a);
      if (sortBy === "year") return Number(b.year) - Number(a.year);
      return 0;
    });
    return result;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [films, minRating, maxRating, yearFilter, sortBy, ratingField]);

  const hasFilters = minRating !== null || maxRating !== null || yearFilter;
  const remaining = total - films.length;
  const hasMore = remaining > 0;

  function loadMore() {
    startTransition(async () => {
      const res = await fetch(`/api/collection?type=${type}&skip=${films.length}&take=${PAGE_SIZE}`);
      if (!res.ok) return;
      const data = await res.json();
      setFilms((prev) => [...prev, ...(data.films as Film[])]);
    });
  }

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
        <FilmGrid
          films={filtered}
          emptyTitle={emptyTitle ?? "Vous n'avez encore noté aucun film."}
          emptyHint={emptyHint ?? 'Utilisez le bouton "+ Ajouter un film" pour commencer.'}
        />
      )}

      {hasMore && !hasFilters && (
        <div className={loadMoreStyles.loadMore}>
          <button className={loadMoreStyles.btn} onClick={loadMore} disabled={isPending}>
            {isPending
              ? "Chargement…"
              : `Charger ${Math.min(remaining, PAGE_SIZE)} film${Math.min(remaining, PAGE_SIZE) > 1 ? "s" : ""} de plus · ${remaining} restant${remaining > 1 ? "s" : ""}`}
          </button>
        </div>
      )}
    </>
  );
}
