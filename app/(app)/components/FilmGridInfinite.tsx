"use client";

import { useState, useTransition } from "react";
import FilmGrid from "./FilmGrid";
import type { TmdbFilmCard } from "@/lib/tmdb";
import styles from "./FilmGridInfinite.module.css";

type RatedFilm = TmdbFilmCard & { rating: number | null };

const PAGE_SIZE = 24;

export default function FilmGridInfinite({
  initialFilms,
  total,
  type,
  emptyTitle,
  emptyHint,
}: {
  initialFilms: RatedFilm[];
  total: number;
  type: "watched" | "liked" | "watchlist" | "all";
  emptyTitle?: string;
  emptyHint?: string;
}) {
  const [films, setFilms] = useState<RatedFilm[]>(initialFilms);
  const [isPending, startTransition] = useTransition();

  const remaining = total - films.length;
  const hasMore = remaining > 0;

  function loadMore() {
    startTransition(async () => {
      const res = await fetch(
        `/api/collection?type=${type}&skip=${films.length}&take=${PAGE_SIZE}`
      );
      if (!res.ok) return;
      const data = await res.json();
      setFilms((prev) => [...prev, ...(data.films as RatedFilm[])]);
    });
  }

  return (
    <div>
      <FilmGrid films={films} emptyTitle={emptyTitle} emptyHint={emptyHint} />
      {hasMore && (
        <div className={styles.loadMore}>
          <button className={styles.btn} onClick={loadMore} disabled={isPending}>
            {isPending
              ? "Chargement…"
              : `Charger ${Math.min(remaining, PAGE_SIZE)} film${Math.min(remaining, PAGE_SIZE) > 1 ? "s" : ""} de plus · ${remaining} restant${remaining > 1 ? "s" : ""}`}
          </button>
        </div>
      )}
    </div>
  );
}
