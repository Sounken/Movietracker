import { GENRES, TV_GENRES } from "@/lib/tmdb-catalog";
import { parseProviders, serializeProviders } from "@/lib/watch-providers";

/**
 * Validation des filtres de « Découvrir » (pages et API, films et séries).
 *
 * Avant, les valeurs de l'URL partaient telles quelles dans la requête TMDB :
 * `minYear`, `maxYear` et `minRating` y étaient concaténés sans contrôle, si
 * bien qu'un `minRating=5%26sort_by%3D…` ajoutait n'importe quel paramètre
 * TMDB. Chaque variante produisait aussi une entrée de cache distincte, et
 * `genre=-1` ou `category=zzz` rendaient une page complète pour rien.
 *
 * Seules passent les valeurs que l'interface sait produire.
 */

const CATEGORIES = {
  movie: ["popular", "for_you", "top_rated", "now_playing", "upcoming"],
  tv: ["popular", "for_you", "top_rated", "on_the_air", "upcoming"],
} as const;

/** Premier film connu (1874) ; au-delà de l'an prochain + 5, rien n'est annoncé. */
const MIN_YEAR = 1874;
const maxYear = () => new Date().getFullYear() + 5;

/** TMDB ne sert pas au-delà de la page 500. */
export const MAX_DISCOVER_PAGE = 500;

export type DiscoverParams = {
  category: string;
  genre: string;
  minYear: string;
  maxYear: string;
  minRating: string;
  providers: string;
  /** Séries seulement. */
  anime: boolean;
};

type Getter = (key: string) => string | null | undefined;

const isYear = (v: string) => /^\d{4}$/.test(v) && Number(v) >= MIN_YEAR && Number(v) <= maxYear();

/** Les paliers de l'interface sont entiers (5 à 9) ; on tolère une décimale. */
const isRating = (v: string) => /^(?:10|\d)(?:\.\d)?$/.test(v) && Number(v) <= 10;

/**
 * Filtres nettoyés, et `valid: false` si au moins une valeur a été écartée.
 * Une valeur absente ou vide n'est pas une erreur.
 */
export function parseDiscoverParams(
  get: Getter,
  media: "movie" | "tv",
): { params: DiscoverParams; valid: boolean } {
  let valid = true;
  const read = (key: string, ok: (v: string) => boolean): string => {
    const v = get(key) ?? "";
    if (v === "" || ok(v)) return v;
    valid = false;
    return "";
  };

  const genres = media === "movie" ? GENRES : TV_GENRES;
  const categories: readonly string[] = CATEGORIES[media];

  const category = read("category", (v) => categories.includes(v)) || "popular";
  const genre = read("genre", (v) => /^\d+$/.test(v) && Number(v) in genres);
  const minYear = read("minYear", isYear);
  const maxYearValue = read("maxYear", isYear);
  const minRating = read("minRating", isRating);
  const anime = read("anime", (v) => media === "tv" && v === "1") === "1";

  // Les plateformes sont déjà filtrées sur liste blanche : on signale
  // seulement qu'une partie de la valeur a été écartée.
  const rawProviders = get("providers") ?? "";
  const providers = serializeProviders(parseProviders(rawProviders) ?? []);
  if (providers !== rawProviders) valid = false;

  return {
    params: { category, genre, minYear, maxYear: maxYearValue, minRating, providers, anime },
    valid,
  };
}

/** Page demandée à l'API (défilement infini) : entier de 1 à 500, ou `null`. */
export function parseDiscoverPage(raw: string | null): number | null {
  if (raw === null || raw === "") return 1;
  if (!/^\d{1,3}$/.test(raw)) return null;
  const page = Number(raw);
  return page >= 1 && page <= MAX_DISCOVER_PAGE ? page : null;
}

/** Requête canonique des filtres retenus, sans les valeurs par défaut. */
export function discoverQuery(p: DiscoverParams): string {
  const q = new URLSearchParams();
  if (p.category !== "popular") q.set("category", p.category);
  if (p.genre) q.set("genre", p.genre);
  if (p.anime) q.set("anime", "1");
  if (p.minYear) q.set("minYear", p.minYear);
  if (p.maxYear) q.set("maxYear", p.maxYear);
  if (p.minRating) q.set("minRating", p.minRating);
  if (p.providers) q.set("providers", p.providers);
  const s = q.toString();
  return s ? `?${s}` : "";
}
