"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Search, X, ArrowUp, ArrowDown } from "lucide-react";
import SeriesGrid, { type SeriesGridItem } from "./SeriesGrid";
import styles from "./CollectionClient.module.css";
import loadMoreStyles from "./FilmGridInfinite.module.css";
import { useRatingScale } from "@/lib/rating-scale";
import { formatRatingOutOf, toDisplayRating } from "@/lib/rating";

type ApiItem = {
  id: number;
  name: string;
  posterUrl: string;
  year: string;
  voteAverage: number;
  rating: number | null;
};

type SortKey = "recent" | "rating" | "year";

const RATINGS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
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
  const scale = useRatingScale();
  const [items, setItems] = useState<ApiItem[]>(initialItems);
  const [totalCount, setTotalCount] = useState(total);
  const [years, setYears] = useState<string[]>([]);

  const [minRating, setMinRating] = useState<number | null>(null);
  const [maxRating, setMaxRating] = useState<number | null>(null);
  const [yearFilter, setYearFilter] = useState<string>("");
  const [sortBy, setSortBy] = useState<SortKey>("recent");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [view, setView] = useState<"default" | "watchlist">("default");

  // Recherche par titre : `query` suit la frappe, `search` est la valeur
  // debouncée réellement envoyée à l'API.
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const id = setTimeout(() => setSearch(query.trim()), 300);
    return () => clearTimeout(id);
  }, [query]);

  // true dès le mount : la requête de métadonnées (années) part immédiatement
  const [loading, setLoading] = useState(true);
  const isInitial = useRef(true);

  const isWatchlist = view === "watchlist";
  const currentType = isWatchlist ? "watchlist" : type;
  // sur la watchlist, les séries n'ont pas de note perso → on trie sur TMDB
  const currentRatingField = isWatchlist ? "voteAverage" : "rating";

  const buildUrl = useCallback(
    (skip: number) => {
      const p = new URLSearchParams({
        type: currentType,
        sort: sortBy,
        dir: sortDir,
        ratingField: currentRatingField,
        skip: String(skip),
        take: String(PAGE_SIZE),
      });
      if (userId) p.set("userId", userId);
      if (minRating !== null) p.set("minRating", String(minRating));
      if (maxRating !== null) p.set("maxRating", String(maxRating));
      if (yearFilter) p.set("year", yearFilter);
      if (search) p.set("q", search);
      return `/api/series-collection?${p.toString()}`;
    },
    [currentType, sortBy, sortDir, currentRatingField, userId, minRating, maxRating, yearFilter, search],
  );

  // Tri/filtres changent → l'URL change → on repasse en chargement pendant le
  // rendu (pattern React « ajuster l'état pendant le rendu »).
  const currentUrl = buildUrl(0);
  const [prevUrl, setPrevUrl] = useState(currentUrl);
  if (currentUrl !== prevUrl) {
    setPrevUrl(currentUrl);
    setLoading(true);
  }

  useEffect(() => {
    // Au premier rendu on garde les données du serveur, mais on récupère quand
    // même la liste des années pour le menu déroulant.
    const metaOnly = isInitial.current;
    isInitial.current = false;

    let cancelled = false;

    fetch(metaOnly ? buildUrl(0).replace(`take=${PAGE_SIZE}`, "take=0") : buildUrl(0))
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled || !data) return;
        setYears(data.years as string[]);
        if (!metaOnly) {
          setItems(data.items as ApiItem[]);
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

  function resetFilters() {
    setMinRating(null);
    setMaxRating(null);
    setYearFilter("");
  }

  function closeSearch() {
    setSearchOpen(false);
    setQuery("");
    setSearch("");
  }

  function switchView(next: "default" | "watchlist") {
    setView(next);
    resetFilters(); // les filtres d'une liste n'ont pas de sens sur l'autre
    closeSearch();
  }

  // Re-cliquer sur le tri actif inverse le sens ; changer de critère repart
  // sur l'ordre décroissant.
  function toggleSort(next: SortKey) {
    if (next === sortBy) setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    else {
      setSortBy(next);
      setSortDir("desc");
    }
  }

  const hasFilters =
    minRating !== null || maxRating !== null || yearFilter !== "" || search !== "";

  const gridItems: SeriesGridItem[] = items.map((s) => ({
    id: s.id,
    name: s.name,
    posterUrl: s.posterUrl,
    year: s.year,
    voteAverage: s.voteAverage,
    caption: !isWatchlist && s.rating != null ? `Ma note : ${formatRatingOutOf(s.rating, scale)}` : s.year,
  }));

  const remaining = totalCount - items.length;

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
                <option key={r} value={r}>≥ {toDisplayRating(r, scale)}</option>
              ))}
            </select>
            <select
              className={styles.select}
              value={maxRating ?? ""}
              onChange={(e) => setMaxRating(e.target.value ? Number(e.target.value) : null)}
            >
              <option value="">Note max</option>
              {RATINGS.slice(1).map((r) => (
                <option key={r} value={r}>≤ {toDisplayRating(r, scale)}</option>
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
            {(minRating !== null || maxRating !== null || yearFilter !== "") && (
              <button className={styles.clearBtn} onClick={resetFilters}>
                Effacer
              </button>
            )}
          </div>
        </div>

        <div className={styles.right}>
          {/* Loupe : se déplie en champ de recherche, à gauche des tris */}
          <div className={`${styles.searchWrap} ${searchOpen ? styles.searchOpen : ""}`}>
            <button
              type="button"
              className={`${styles.sortBtn} ${styles.iconBtn} ${searchOpen ? styles.sortOn : ""}`}
              onClick={() => {
                if (searchOpen) closeSearch();
                else {
                  setSearchOpen(true);
                  requestAnimationFrame(() => searchInputRef.current?.focus());
                }
              }}
              aria-label={searchOpen ? "Fermer la recherche" : "Rechercher une série"}
              aria-expanded={searchOpen}
            >
              <Search size={14} />
            </button>
            {searchOpen && (
              <div className={styles.searchField}>
                <input
                  ref={searchInputRef}
                  type="search"
                  className={styles.searchInput}
                  placeholder="Rechercher un titre…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Escape" && closeSearch()}
                />
                {query && (
                  <button
                    type="button"
                    className={styles.searchClear}
                    onClick={() => {
                      setQuery("");
                      searchInputRef.current?.focus();
                    }}
                    aria-label="Effacer la recherche"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>
            )}
          </div>

          {(["recent", "rating", "year"] as const).map((s) => (
            <button
              key={s}
              className={`${styles.sortBtn} ${sortBy === s ? styles.sortOn : ""}`}
              onClick={() => toggleSort(s)}
              title={
                sortBy === s
                  ? sortDir === "desc"
                    ? "Trier par ordre croissant"
                    : "Trier par ordre décroissant"
                  : undefined
              }
            >
              {s === "recent" ? "Récents" : s === "rating" ? "Notes" : "Année"}
              {sortBy === s &&
                (sortDir === "desc" ? (
                  <ArrowDown size={11} className={styles.sortArrow} />
                ) : (
                  <ArrowUp size={11} className={styles.sortArrow} />
                ))}
            </button>
          ))}

          {showWatchlist && (
            <button
              className={`${styles.sortBtn} ${styles.viewBtn} ${isWatchlist ? styles.sortOn : ""}`}
              onClick={() => switchView(isWatchlist ? "default" : "watchlist")}
              title={
                isWatchlist ? "Revenir aux séries notées" : "Afficher uniquement les séries à voir"
              }
            >
              Watchlist
            </button>
          )}
        </div>
      </div>

      {items.length === 0 && (hasFilters || loading) ? (
        <div className={styles.noResult}>
          {loading
            ? "Chargement…"
            : search
              ? `Aucune série ne correspond à « ${search} ».`
              : "Aucune série ne correspond à ces filtres."}
        </div>
      ) : (
        <SeriesGrid
          items={gridItems}
          empty={
            isWatchlist
              ? "Aucune série dans la watchlist."
              : (emptyTitle ?? "Aucune série notée pour l'instant.")
          }
        />
      )}

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
