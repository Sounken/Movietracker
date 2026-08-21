"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { ChevronDown, X } from "lucide-react";
import { GENRES, TV_GENRES, type CompanySort } from "@/lib/tmdb";
import styles from "../../../(app)/films/discover/discover.module.css";

const SORTS: Array<{ id: CompanySort; label: string }> = [
  { id: "recent", label: "Plus récents" },
  { id: "oldest", label: "Plus anciens" },
  { id: "popular", label: "Populaires" },
  { id: "rating", label: "Mieux notés" },
];

// Les deux médias ont des nomenclatures de genres distinctes chez TMDB.
const genreList = (table: Record<number, string>) =>
  Object.entries(table)
    .map(([id, name]) => ({ id: Number(id), name }))
    .sort((a, b) => a.name.localeCompare(b.name, "fr"));

const MOVIE_GENRES = genreList(GENRES);
const SERIES_GENRES = genreList(TV_GENRES);

function decades(): Array<{ label: string; min: string; max: string }> {
  const current = Math.floor(new Date().getFullYear() / 10) * 10;
  const out: Array<{ label: string; min: string; max: string }> = [];
  for (let d = current; d >= 1950; d -= 10) {
    out.push({ label: `${d}s`, min: String(d), max: String(d + 9) });
  }
  out.push({ label: "Avant 1950", min: "1900", max: "1949" });
  return out;
}

const DECADES = decades();
const MIN_RATINGS = [8, 7, 6, 5];

function Dropdown({
  label,
  active,
  children,
}: {
  label: string;
  active: boolean;
  children: (close: () => void) => React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className={styles.dropdown} ref={wrapRef}>
      <button
        type="button"
        className={`${styles.dropdownBtn} ${active ? styles.dropdownOn : ""}`}
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        {label}
        <ChevronDown size={13} className={`${styles.chevron} ${open ? styles.chevronUp : ""}`} />
      </button>
      {open && <div className={styles.dropdownPanel}>{children(() => setOpen(false))}</div>}
    </div>
  );
}

export default function CompanyFilters({
  sort,
  genre,
  minYear,
  maxYear,
  minRating,
  media,
  hasSeries,
}: {
  sort: CompanySort;
  genre: string;
  minYear: string;
  maxYear: string;
  minRating: string;
  media: "movie" | "tv";
  /** Masque la bascule quand le studio n'a produit aucune série. */
  hasSeries: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const setParams = (updates: Record<string, string>) => {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(updates)) {
      if (value) params.set(key, value);
      else params.delete(key);
    }
    const q = params.toString();
    router.push(`${pathname}${q ? `?${q}` : ""}`);
  };

  const GENRE_LIST = media === "tv" ? SERIES_GENRES : MOVIE_GENRES;
  const genreName = GENRE_LIST.find((g) => String(g.id) === genre)?.name;
  const activeDecade = DECADES.find((d) => d.min === minYear && d.max === maxYear);
  const periodLabel = activeDecade
    ? activeDecade.label
    : minYear || maxYear
      ? `${minYear || "…"} – ${maxYear || "…"}`
      : "Période";

  const hasFilters = Boolean(genre || minYear || maxYear || minRating);

  return (
    <div className={styles.filters}>
      {hasSeries && (
        <div className={styles.categoryTabs}>
          {([
            { id: "movie", label: "Films" },
            { id: "tv", label: "Séries" },
          ] as const).map((m) => (
            <button
              key={m.id}
              className={`${styles.tab} ${media === m.id ? styles.tabOn : ""}`}
              // Changer de média invalide le genre : les tables d'identifiants
              // ne se recoupent pas (18 = Drame des deux côtés, mais 28 = Action
              // n'existe pas en TV).
              onClick={() => setParams({ media: m.id === "movie" ? "" : m.id, genre: "" })}
            >
              {m.label}
            </button>
          ))}
        </div>
      )}

      <div className={styles.categoryTabs}>
        {SORTS.map((s) => (
          <button
            key={s.id}
            className={`${styles.tab} ${sort === s.id ? styles.tabOn : ""}`}
            // « recent » est le défaut : on ne l'écrit pas dans l'URL.
            onClick={() => setParams({ sort: s.id === "recent" ? "" : s.id })}
          >
            {s.label}
          </button>
        ))}
      </div>

      <div className={styles.filterRow}>
        <Dropdown label={genreName ?? "Genre"} active={Boolean(genre)}>
          {(close) => (
            <div className={styles.genreGrid}>
              <button
                className={`${styles.pill} ${!genre ? styles.pillOn : ""}`}
                onClick={() => {
                  setParams({ genre: "" });
                  close();
                }}
              >
                Tous
              </button>
              {GENRE_LIST.map((g) => (
                <button
                  key={g.id}
                  className={`${styles.pill} ${genre === String(g.id) ? styles.pillOn : ""}`}
                  onClick={() => {
                    setParams({ genre: genre === String(g.id) ? "" : String(g.id) });
                    close();
                  }}
                >
                  {g.name}
                </button>
              ))}
            </div>
          )}
        </Dropdown>

        <Dropdown label={periodLabel} active={Boolean(minYear || maxYear)}>
          {(close) => (
            <div className={styles.dropdownList}>
              <button
                className={`${styles.dropdownItem} ${!minYear && !maxYear ? styles.dropdownItemOn : ""}`}
                onClick={() => {
                  setParams({ minYear: "", maxYear: "" });
                  close();
                }}
              >
                Toutes les années
              </button>
              {DECADES.map((d) => (
                <button
                  key={d.label}
                  className={`${styles.dropdownItem} ${activeDecade?.label === d.label ? styles.dropdownItemOn : ""}`}
                  onClick={() => {
                    setParams({ minYear: d.min, maxYear: d.max });
                    close();
                  }}
                >
                  {d.label}
                </button>
              ))}
            </div>
          )}
        </Dropdown>

        <Dropdown label={minRating ? `★ ${minRating}+` : "Note"} active={Boolean(minRating)}>
          {(close) => (
            <div className={styles.dropdownList}>
              <button
                className={`${styles.dropdownItem} ${!minRating ? styles.dropdownItemOn : ""}`}
                onClick={() => {
                  setParams({ minRating: "" });
                  close();
                }}
              >
                Toutes les notes
              </button>
              {MIN_RATINGS.map((r) => (
                <button
                  key={r}
                  className={`${styles.dropdownItem} ${minRating === String(r) ? styles.dropdownItemOn : ""}`}
                  onClick={() => {
                    setParams({ minRating: String(r) });
                    close();
                  }}
                >
                  ★ {r} et plus
                </button>
              ))}
            </div>
          )}
        </Dropdown>

        {hasFilters && (
          <button
            className={styles.clearFilters}
            onClick={() => setParams({ genre: "", minYear: "", maxYear: "", minRating: "" })}
          >
            <X size={12} /> Effacer
          </button>
        )}
      </div>
    </div>
  );
}
