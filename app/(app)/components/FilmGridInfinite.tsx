"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import FilmGrid from "./FilmGrid";
import { useRestorableList } from "./use-restorable-list";
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
  /**
   * `hasMore` est déduit de `total`, pas tenu par le hook : on ne lui demande
   * donc que de conserver la liste. Les cartes sont rendues par `FilmGrid`, où
   * l'on ne peut pas accrocher de `onClick` — c'est l'enregistrement au
   * démontage qui couvre le départ vers une fiche.
   */
  const { items: films, setItems: setFilms } = useRestorableList<RatedFilm>(
    `collection:${type}`,
    initialFilms,
    false,
  );
  const [loading, setLoading] = useState(false);
  const loadingRef = useRef(false);

  const remaining = total - films.length;
  const hasMore = remaining > 0;

  const loadMore = useCallback(() => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    setLoading(true);

    fetch(`/api/collection?type=${type}&skip=${films.length}&take=${PAGE_SIZE}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) setFilms((prev) => [...prev, ...(data.films as RatedFilm[])]);
      })
      .finally(() => {
        loadingRef.current = false;
        setLoading(false);
      });
    // Setter stable issu de `useRestorableList`.
  }, [type, films.length, setFilms]);

  // Scroll infini : charge la suite dès que la sentinelle approche du viewport
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) loadMore();
      },
      { rootMargin: "400px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore, loadMore]);

  return (
    <div>
      <FilmGrid films={films} emptyTitle={emptyTitle} emptyHint={emptyHint} />
      {hasMore && (
        <div ref={sentinelRef} className={styles.loadMore}>
          <button className={styles.btn} onClick={loadMore} disabled={loading}>
            {loading
              ? "Chargement…"
              : `Charger ${Math.min(remaining, PAGE_SIZE)} film${Math.min(remaining, PAGE_SIZE) > 1 ? "s" : ""} de plus • ${remaining} restant${remaining > 1 ? "s" : ""}`}
          </button>
        </div>
      )}
    </div>
  );
}
