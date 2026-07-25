"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import FilmGrid from "./FilmGrid";
import type { TmdbFilmCard } from "@/lib/tmdb";
import styles from "./CollectionClient.module.css";
import loadMoreStyles from "./FilmGridInfinite.module.css";

type Film = TmdbFilmCard & { rating: number | null };
type SortKey = "recent" | "rating" | "year";

const RATINGS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const PAGE_SIZE = 24;

export default function CollectionClient({
  films: initialFilms,
  total,
  type = "rated",
  ratingField = "rating",
  emptyTitle,
  emptyHint,
  userId,
  showWatchlist = false,
}: {
  films: Film[];
  total: number;
  type?: "rated" | "watchlist" | "liked" | "all";
  ratingField?: "rating" | "voteAverage";
  emptyTitle?: string;
  emptyHint?: string;
  /** Collection d'un autre utilisateur (profil public). Par défaut : soi-même. */
  userId?: string;
  /** Affiche un bouton « Watchlist » qui bascule la liste sur les films à voir. */
  showWatchlist?: boolean;
}) {
  const [films, setFilms] = useState<Film[]>(initialFilms);
  const [totalCount, setTotalCount] = useState(total);
  const [years, setYears] = useState<string[]>([]);

  const [minRating, setMinRating] = useState<number | null>(null);
  const [maxRating, setMaxRating] = useState<number | null>(null);
  const [yearFilter, setYearFilter] = useState<string>("");
  const [sortBy, setSortBy] = useState<SortKey>("recent");
  const [view, setView] = useState<"default" | "watchlist">("default");

  // true dès le mount : la première requête (métadonnées) part immédiatement
  const [loading, setLoading] = useState(true);
  // true tant qu'on affiche encore les données rendues côté serveur
  const isInitial = useRef(true);

  const isWatchlist = view === "watchlist";
  const currentType = isWatchlist ? "watchlist" : type;
  // sur la watchlist, les films n'ont pas de note perso → on trie sur la note TMDB
  const currentRatingField = isWatchlist ? "voteAverage" : ratingField;

  const buildUrl = useCallback(
    (skip: number) => {
      const p = new URLSearchParams({
        type: currentType,
        sort: sortBy,
        ratingField: currentRatingField,
        skip: String(skip),
        take: String(PAGE_SIZE),
      });
      if (userId) p.set("userId", userId);
      if (minRating !== null) p.set("minRating", String(minRating));
      if (maxRating !== null) p.set("maxRating", String(maxRating));
      if (yearFilter) p.set("year", yearFilter);
      return `/api/collection?${p.toString()}`;
    },
    [currentType, sortBy, currentRatingField, userId, minRating, maxRating, yearFilter],
  );

  // Quand tri/filtres changent, l'URL change → on repasse en chargement
  // pendant le rendu (pattern React « ajuster l'état pendant le rendu »).
  const currentUrl = buildUrl(0);
  const [prevUrl, setPrevUrl] = useState(currentUrl);
  if (currentUrl !== prevUrl) {
    setPrevUrl(currentUrl);
    setLoading(true);
  }

  // ——— Tri / filtres : rechargés depuis le serveur, sur TOUTE la collection ———
  useEffect(() => {
    // au tout premier rendu on garde les données du serveur, mais on récupère
    // quand même la liste complète des années pour le menu déroulant
    const metaOnly = isInitial.current;
    isInitial.current = false;

    let cancelled = false;

    fetch(metaOnly ? buildUrl(0).replace(`take=${PAGE_SIZE}`, "take=0") : buildUrl(0))
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled || !data) return;
        setYears(data.years as string[]);
        if (!metaOnly) {
          setFilms(data.films as Film[]);
          setTotalCount(data.total as number);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [buildUrl]);

  // ——— Chargement de la suite ———
  const loadingRef = useRef(false);
  const loadMore = useCallback(() => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    setLoading(true);

    fetch(buildUrl(films.length))
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) setFilms((prev) => [...prev, ...(data.films as Film[])]);
      })
      .finally(() => {
        loadingRef.current = false;
        setLoading(false);
      });
  }, [buildUrl, films.length]);

  const hasMore = films.length < totalCount;

  // ——— Scroll infini : on charge dès que la sentinelle approche du viewport ———
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) loadMore();
      },
      { rootMargin: "400px" }, // anticipe pour que le chargement soit invisible
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore, loadMore]);

  function resetFilters() {
    setMinRating(null);
    setMaxRating(null);
    setYearFilter("");
  }

  function switchView(next: "default" | "watchlist") {
    setView(next);
    resetFilters(); // les filtres d'une liste n'ont pas de sens sur l'autre
  }

  const hasFilters = minRating !== null || maxRating !== null || yearFilter !== "";
  const remaining = totalCount - films.length;

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
              <button className={styles.clearBtn} onClick={resetFilters}>
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
          {showWatchlist && (
            <button
              className={`${styles.sortBtn} ${styles.viewBtn} ${isWatchlist ? styles.sortOn : ""}`}
              onClick={() => switchView(isWatchlist ? "default" : "watchlist")}
              title={
                isWatchlist
                  ? "Revenir aux films notés"
                  : "Afficher uniquement les films à voir"
              }
            >
              Watchlist
            </button>
          )}
        </div>
      </div>

      {films.length === 0 && (hasFilters || loading) ? (
        <div className={styles.noResult}>
          {loading ? "Chargement…" : "Aucun film ne correspond à ces filtres."}
        </div>
      ) : (
        <FilmGrid
          films={films}
          emptyTitle={
            isWatchlist
              ? "Aucun film dans la watchlist."
              : (emptyTitle ?? "Vous n'avez encore noté aucun film.")
          }
          emptyHint={
            isWatchlist
              ? "Ajoutez des films à voir depuis leur fiche."
              : (emptyHint ?? 'Utilisez le bouton "+ Ajouter un film" pour commencer.')
          }
        />
      )}

      {/* Sentinelle : déclenche le chargement automatique au scroll.
          Le bouton reste disponible (accessibilité / JS lent). */}
      {hasMore && (
        <div ref={sentinelRef} className={loadMoreStyles.loadMore}>
          <button className={loadMoreStyles.btn} onClick={loadMore} disabled={loading}>
            {loading
              ? "Chargement…"
              : `Charger ${Math.min(remaining, PAGE_SIZE)} film${Math.min(remaining, PAGE_SIZE) > 1 ? "s" : ""} de plus · ${remaining} restant${remaining > 1 ? "s" : ""}`}
          </button>
        </div>
      )}
    </>
  );
}
