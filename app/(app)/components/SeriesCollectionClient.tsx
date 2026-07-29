"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import SeriesGrid, { type SeriesGridItem } from "./SeriesGrid";
import styles from "../films/collection.module.css";
import loadMoreStyles from "./FilmGridInfinite.module.css";

type ApiItem = {
  id: number;
  name: string;
  posterUrl: string;
  year: string;
  voteAverage: number;
  rating: number | null;
};

const PAGE_SIZE = 24;

export default function SeriesCollectionClient({
  initialItems,
  total,
  type = "rated",
  userId,
  showWatchlist = false,
  emptyTitle,
}: {
  initialItems: ApiItem[];
  total: number;
  type?: "rated" | "watchlist" | "liked";
  userId?: string;
  showWatchlist?: boolean;
  emptyTitle?: string;
}) {
  const [items, setItems] = useState<ApiItem[]>(initialItems);
  const [totalCount, setTotalCount] = useState(total);
  const [sortBy, setSortBy] = useState<"recent" | "rating" | "year">("recent");
  const [view, setView] = useState<"default" | "watchlist">("default");
  const [loading, setLoading] = useState(false);
  const isInitial = useRef(true);

  const isWatchlist = view === "watchlist";
  const currentType = isWatchlist ? "watchlist" : type;
  const ratingField = isWatchlist ? "voteAverage" : "rating";

  const buildUrl = useCallback(
    (skip: number) => {
      const p = new URLSearchParams({
        type: currentType,
        sort: sortBy,
        ratingField,
        skip: String(skip),
        take: String(PAGE_SIZE),
      });
      if (userId) p.set("userId", userId);
      return `/api/series-collection?${p.toString()}`;
    },
    [currentType, sortBy, ratingField, userId],
  );

  useEffect(() => {
    if (isInitial.current) {
      isInitial.current = false;
      return;
    }
    let cancelled = false;
    setLoading(true);
    fetch(buildUrl(0))
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled || !data) return;
        setItems(data.items as ApiItem[]);
        setTotalCount(data.total as number);
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [buildUrl]);

  const loadingRef = useRef(false);
  const loadMore = useCallback(() => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    setLoading(true);
    fetch(buildUrl(items.length))
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) setItems((prev) => [...prev, ...(data.items as ApiItem[])]);
      })
      .finally(() => {
        loadingRef.current = false;
        setLoading(false);
      });
  }, [buildUrl, items.length]);

  const hasMore = items.length < totalCount;
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasMore) return;
    const observer = new IntersectionObserver(
      (entries) => entries[0]?.isIntersecting && loadMore(),
      { rootMargin: "400px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore, loadMore]);

  const gridItems: SeriesGridItem[] = items.map((s) => ({
    id: s.id,
    name: s.name,
    posterUrl: s.posterUrl,
    year: s.year,
    voteAverage: s.voteAverage,
    caption: !isWatchlist && s.rating != null ? `Ma note : ${s.rating}/10` : s.year,
  }));

  const remaining = totalCount - items.length;

  return (
    <>
      <div className={styles.toolbar}>
        <div className={styles.left} />
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
          {showWatchlist && (
            <button
              className={`${styles.sortBtn} ${styles.viewBtn} ${isWatchlist ? styles.sortOn : ""}`}
              onClick={() => setView(isWatchlist ? "default" : "watchlist")}
            >
              Watchlist
            </button>
          )}
        </div>
      </div>

      <SeriesGrid
        items={gridItems}
        empty={
          isWatchlist
            ? "Aucune série dans la watchlist."
            : (emptyTitle ?? "Aucune série notée pour l'instant.")
        }
      />

      {hasMore && (
        <div ref={sentinelRef} className={loadMoreStyles.loadMore}>
          <button className={loadMoreStyles.btn} onClick={loadMore} disabled={loading}>
            {loading
              ? "Chargement…"
              : `Charger ${Math.min(remaining, PAGE_SIZE)} série${Math.min(remaining, PAGE_SIZE) > 1 ? "s" : ""} de plus · ${remaining} restante${remaining > 1 ? "s" : ""}`}
          </button>
        </div>
      )}
    </>
  );
}
