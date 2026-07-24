"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import type { TmdbDiscoverFilm } from "@/lib/tmdb";
import styles from "./discover.module.css";

const PlusIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="36" height="36" strokeLinecap="round">
    <path d="M12 5v14M5 12h14" />
  </svg>
);

const SpinnerIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="28" height="28" className={styles.spin}>
    <path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round" />
  </svg>
);

export default function DiscoverGrid({
  initialFilms,
  category,
  genre,
}: {
  initialFilms: TmdbDiscoverFilm[];
  category: string;
  genre: string;
}) {
  const [films, setFilms] = useState(initialFilms);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(initialFilms.length === 20);
  const [loading, setLoading] = useState(false);
  const loadingRef = useRef(false);

  const loadMore = useCallback(() => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    setLoading(true);

    const nextPage = page + 1;
    const params = new URLSearchParams({ category, page: String(nextPage) });
    if (genre) params.set("genre", genre);

    fetch(`/api/discover?${params}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((more: TmdbDiscoverFilm[]) => {
        setFilms((prev) => [...prev, ...more]);
        setPage(nextPage);
        if (more.length < 20) setHasMore(false);
      })
      .finally(() => {
        loadingRef.current = false;
        setLoading(false);
      });
  }, [category, genre, page]);

  // Scroll infini : la carte « Afficher plus » se déclenche seule à l'approche
  const sentinelRef = useRef<HTMLButtonElement | null>(null);
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

  if (films.length === 0) {
    return <div className={styles.empty}>Aucun film trouvé pour ces filtres.</div>;
  }

  return (
    <div className={styles.grid}>
      {films.map((film) => (
        <Link key={film.id} href={`/film/${film.id}`} className={styles.filmCard}>
          <div
            className={styles.poster}
            style={film.posterUrl ? { backgroundImage: `url("${film.posterUrl}")` } : undefined}
          >
            {film.voteAverage > 0 && (
              <div className={styles.score}>★ {film.voteAverage}</div>
            )}
          </div>
          <div className={styles.info}>
            <div className={styles.title}>{film.title}</div>
            {film.year && <div className={styles.year}>{film.year}</div>}
          </div>
        </Link>
      ))}

      {hasMore && (
        <button
          ref={sentinelRef}
          className={`${styles.filmCard} ${styles.loadMoreCard}`}
          onClick={loadMore}
          disabled={loading}
        >
          <div className={styles.loadMorePoster}>
            {loading ? <SpinnerIcon /> : <PlusIcon />}
          </div>
          <div className={styles.info}>
            <div className={styles.title}>
              {loading ? "Chargement…" : "Afficher plus"}
            </div>
          </div>
        </button>
      )}
    </div>
  );
}
