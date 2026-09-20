"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { Plus, Loader2 } from "lucide-react";
import type { TmdbDiscoverSeries } from "@/lib/tmdb";
import { useRestorableList } from "@/app/(app)/components/use-restorable-list";
import styles from "../../films/discover/discover.module.css";
import { Rating } from "@/lib/rating-scale";

export default function SeriesDiscoverGrid({
  initialSeries,
  category,
  anime,
  genre = "",
  minYear = "",
  maxYear = "",
  minRating = "",
  providers = "",
  emptyMessage,
}: {
  initialSeries: TmdbDiscoverSeries[];
  category: string;
  anime: boolean;
  genre?: string;
  minYear?: string;
  maxYear?: string;
  minRating?: string;
  providers?: string;
  emptyMessage?: string;
}) {
  // Même clé composite que pour les films, avec le filtre anime en plus.
  const {
    items: series,
    setItems: setSeries,
    page,
    setPage,
    hasMore,
    setHasMore,
    save,
  } = useRestorableList<TmdbDiscoverSeries>(
    `series:${category}:${anime ? "anime" : "all"}:${genre}:${minYear}:${maxYear}:${minRating}:${providers}`,
    initialSeries,
    initialSeries.length === 20,
  );
  const [loading, setLoading] = useState(false);
  const loadingRef = useRef(false);

  const loadMore = useCallback(() => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    setLoading(true);

    const nextPage = page + 1;
    const params = new URLSearchParams({ category, page: String(nextPage) });
    if (anime) params.set("anime", "1");
    if (genre) params.set("genre", genre);
    if (minYear) params.set("minYear", minYear);
    if (maxYear) params.set("maxYear", maxYear);
    if (minRating) params.set("minRating", minRating);
    if (providers) params.set("providers", providers);

    fetch(`/api/discover/tv?${params}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((more: TmdbDiscoverSeries[]) => {
        setSeries((prev) => [...prev, ...more]);
        setPage(nextPage);
        if (more.length < 20) setHasMore(false);
      })
      .finally(() => {
        loadingRef.current = false;
        setLoading(false);
      });
    // Setters stables issus de `useRestorableList`.
  }, [category, anime, genre, minYear, maxYear, minRating, providers, page, setSeries, setPage, setHasMore]);

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

  if (series.length === 0) {
    return (
      <div className={styles.empty}>
        {emptyMessage ?? "Aucune série trouvée pour ces filtres."}
      </div>
    );
  }

  return (
    <div className={`${styles.grid} stagger`}>
      {series.map((s) => (
        <Link key={s.id} href={`/series/${s.id}`} className={styles.filmCard} onClick={save}>
          <div className={styles.poster}>
            {s.posterUrl && (
              <Image
                src={s.posterUrl}
                alt=""
                fill
                sizes="(max-width: 768px) 50vw, 200px"
                style={{ objectFit: "cover" }}
              />
            )}
            {s.voteAverage > 0 && <div className={styles.score}>★ <Rating value={s.voteAverage} /></div>}
          </div>
          <div className={styles.info}>
            <div className={styles.title}>{s.name}</div>
            {s.year && <div className={styles.year}>{s.year}</div>}
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
            {loading ? <Loader2 size={28} className={styles.spin} /> : <Plus size={36} />}
          </div>
          <div className={styles.info}>
            <div className={styles.title}>{loading ? "Chargement…" : "Afficher plus"}</div>
          </div>
        </button>
      )}
    </div>
  );
}
