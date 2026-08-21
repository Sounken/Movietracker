"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronDown, X, Check } from "lucide-react";
import { WATCH_PROVIDERS } from "@/lib/tmdb";
import { parseProviders, serializeProviders } from "@/lib/watch-providers";
import styles from "./discover.module.css";

const CATEGORIES = [
  { id: "popular", label: "Populaires", authOnly: false },
  { id: "for_you", label: "Pour vous", authOnly: true },
  { id: "top_rated", label: "Mieux notés", authOnly: false },
  { id: "now_playing", label: "En salle", authOnly: false },
  { id: "upcoming", label: "À venir", authOnly: false },
];

// « Pour vous » est un classement personnel : le filtrer par genre ou par
// décennie reviendrait à écraser la recommandation par une requête générique.
const FILTERABLE = (category: string) => category !== "for_you";

const GENRE_LIST = [
  { id: 28, name: "Action" },
  { id: 12, name: "Aventure" },
  { id: 16, name: "Animation" },
  { id: 35, name: "Comédie" },
  { id: 80, name: "Crime" },
  { id: 99, name: "Documentaire" },
  { id: 18, name: "Drame" },
  { id: 10751, name: "Famille" },
  { id: 14, name: "Fantastique" },
  { id: 36, name: "Histoire" },
  { id: 27, name: "Horreur" },
  { id: 10402, name: "Musique" },
  { id: 9648, name: "Mystère" },
  { id: 10749, name: "Romance" },
  { id: 878, name: "Science-Fiction" },
  { id: 53, name: "Thriller" },
  { id: 10752, name: "Guerre" },
  { id: 37, name: "Western" },
];

// Décennies proposées, de la plus récente à 1950. Bornes inclusives.
function decades(): Array<{ label: string; min: string; max: string }> {
  const currentDecade = Math.floor(new Date().getFullYear() / 10) * 10;
  const out: Array<{ label: string; min: string; max: string }> = [];
  for (let d = currentDecade; d >= 1950; d -= 10) {
    out.push({ label: `${d}s`, min: String(d), max: String(d + 9) });
  }
  out.push({ label: "Avant 1950", min: "1900", max: "1949" });
  return out;
}

const DECADES = decades();
const MIN_RATINGS = [9, 8, 7, 6, 5];

/** Bouton + panneau flottant, fermé au clic extérieur et à Échap. */
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

export default function DiscoverFilters({
  category,
  genre,
  minYear,
  maxYear,
  minRating,
  providers,
  showForYou,
}: {
  category: string;
  genre: string;
  minYear: string;
  maxYear: string;
  minRating: string;
  /** Sélection de plateformes, telle qu'elle apparaît dans l'URL (« 8,119 »). */
  providers: string;
  showForYou: boolean;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Applique plusieurs paramètres d'un coup : changer de décennie touche
  // minYear ET maxYear, deux router.push successifs perdraient le premier.
  const setParams = (updates: Record<string, string>) => {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(updates)) {
      if (value) params.set(key, value);
      else params.delete(key);
    }
    const q = params.toString();
    router.push(`/films/discover${q ? `?${q}` : ""}`);
  };

  const genreName = GENRE_LIST.find((g) => String(g.id) === genre)?.name;
  const activeDecade = DECADES.find((d) => d.min === minYear && d.max === maxYear);
  const periodLabel = activeDecade
    ? activeDecade.label
    : minYear || maxYear
      ? `${minYear || "…"} – ${maxYear || "…"}`
      : "Période";

  // Multi-sélection : on bascule un identifiant sans fermer le panneau, pour
  // pouvoir cocher Netflix puis Prime d'affilée.
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

  const hasFilters = Boolean(genre || minYear || maxYear || minRating || providers);

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

      {FILTERABLE(category) && (
      <div className={styles.filterRow}>
        {/* ——— Genres ——— */}
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

        {/* ——— Date de sortie ——— */}
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

        {/* ——— Note minimale ——— */}
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

        {hasFilters && (
          <button
            className={styles.clearFilters}
            onClick={() =>
              setParams({ genre: "", minYear: "", maxYear: "", minRating: "", providers: "" })
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
