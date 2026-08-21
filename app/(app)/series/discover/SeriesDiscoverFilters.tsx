"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronDown, X, Check } from "lucide-react";
import { TV_GENRES, WATCH_PROVIDERS } from "@/lib/tmdb";
import { parseProviders, serializeProviders } from "@/lib/watch-providers";
import styles from "../../films/discover/discover.module.css";

const CATEGORIES = [
  { id: "popular", label: "Populaires", authOnly: false },
  { id: "for_you", label: "Pour vous", authOnly: true },
  { id: "top_rated", label: "Mieux notées", authOnly: false },
  { id: "on_the_air", label: "En diffusion", authOnly: false },
  { id: "upcoming", label: "À venir", authOnly: false },
];

// Nomenclature TV de TMDB, triée alphabétiquement pour la lisibilité du panneau.
const GENRE_LIST = Object.entries(TV_GENRES)
  .map(([id, name]) => ({ id: Number(id), name }))
  .sort((a, b) => a.name.localeCompare(b.name, "fr"));

function decades(): Array<{ label: string; min: string; max: string }> {
  const currentDecade = Math.floor(new Date().getFullYear() / 10) * 10;
  const out: Array<{ label: string; min: string; max: string }> = [];
  for (let d = currentDecade; d >= 1960; d -= 10) {
    out.push({ label: `${d}s`, min: String(d), max: String(d + 9) });
  }
  out.push({ label: "Avant 1960", min: "1900", max: "1959" });
  return out;
}

const DECADES = decades();
const MIN_RATINGS = [9, 8, 7, 6, 5];

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

export default function SeriesDiscoverFilters({
  category,
  genre,
  anime,
  minYear,
  maxYear,
  minRating,
  providers,
  showForYou,
}: {
  category: string;
  genre: string;
  anime: boolean;
  minYear: string;
  maxYear: string;
  minRating: string;
  /** Sélection de plateformes telle qu'elle apparaît dans l'URL (« 8,119 »). */
  providers: string;
  showForYou: boolean;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const setParams = (updates: Record<string, string>) => {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(updates)) {
      if (value) params.set(key, value);
      else params.delete(key);
    }
    const q = params.toString();
    router.push(`/series/discover${q ? `?${q}` : ""}`);
  };

  const genreName = GENRE_LIST.find((g) => String(g.id) === genre)?.name;
  const activeDecade = DECADES.find((d) => d.min === minYear && d.max === maxYear);
  const periodLabel = activeDecade
    ? activeDecade.label
    : minYear || maxYear
      ? `${minYear || "…"} – ${maxYear || "…"}`
      : "Période";

  // Multi-sélection : on bascule un identifiant sans fermer le panneau.
  const selectedProviders = parseProviders(providers) ?? [];
  const toggleProvider = (id: number) => {
    const next = selectedProviders.includes(id)
      ? selectedProviders.filter((p) => p !== id)
      : [...selectedProviders, id];
    setParams({ providers: serializeProviders(next) });
  };

  const providerLabel =
    selectedProviders.length === 0
      ? "Plateforme"
      : selectedProviders.length === 1
        ? (WATCH_PROVIDERS.find((p) => p.id === selectedProviders[0])?.name ?? "Plateforme")
        : `${selectedProviders.length} plateformes`;

  const hasFilters = Boolean(genre || minYear || maxYear || minRating || anime || providers);
  const filterable = category !== "for_you";

  return (
    <div className={styles.filters}>
      <div className={styles.categoryTabs}>
        {CATEGORIES.filter((c) => !c.authOnly || showForYou).map((cat) => (
          <button
            key={cat.id}
            className={`${styles.tab} ${category === cat.id ? styles.tabOn : ""}`}
            onClick={() => setParams({ category: cat.id === "popular" ? "" : cat.id })}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {filterable && (
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

          {/* ——— Plateformes (multi-sélection) ——— */}
          <Dropdown label={providerLabel} active={selectedProviders.length > 0}>
            {() => (
              <div className={styles.dropdownList}>
                <button
                  className={`${styles.dropdownItem} ${selectedProviders.length === 0 ? styles.dropdownItemOn : ""}`}
                  onClick={() => setParams({ providers: "" })}
                >
                  Toutes les plateformes
                </button>
                {WATCH_PROVIDERS.map((p) => {
                  const on = selectedProviders.includes(p.id);
                  return (
                    <button
                      key={p.id}
                      className={`${styles.dropdownItem} ${styles.checkItem} ${on ? styles.dropdownItemOn : ""}`}
                      onClick={() => toggleProvider(p.id)}
                    >
                      <span className={`${styles.checkBox} ${on ? styles.checkBoxOn : ""}`}>
                        {on && <Check size={10} strokeWidth={3} />}
                      </span>
                      {p.name}
                    </button>
                  );
                })}
              </div>
            )}
          </Dropdown>

          {/* L'anime reste une bascule à part : ce n'est pas un genre TMDB mais
              la combinaison Animation + langue japonaise. */}
          <button
            className={`${styles.dropdownBtn} ${anime ? styles.dropdownOn : ""}`}
            onClick={() => setParams({ anime: anime ? "" : "1" })}
          >
            Anime
          </button>

          {hasFilters && (
            <button
              className={styles.clearFilters}
              onClick={() =>
                setParams({ genre: "", minYear: "", maxYear: "", minRating: "", anime: "", providers: "" })
              }
            >
              <X size={12} /> Effacer
            </button>
          )}
        </div>
      )}
    </div>
  );
}
