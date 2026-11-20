import "server-only";
import { prisma } from "@/lib/db";
import { fetchNowPlaying, fetchNewOnStreaming, fetchFilmLogo, type TmdbFilmCard, type TmdbMovie } from "@/lib/tmdb";
import { getFilmCards } from "@/lib/films";

/**
 * Données de l'accueil Films, partagées entre le design actuel et les
 * maquettes à l'essai (`?design=…`) : chaque design ne change que le rendu,
 * jamais les requêtes.
 */

/**
 * Sources du carrousel. « Festivals » a été retiré : TMDB n'expose aucune
 * notion de festival, et les distinctions Wikidata de `lib/awards.ts` se lisent
 * film par film, après coup — de quoi dire « ce film a eu la Palme », pas de
 * quoi bâtir une liste.
 */
export const HERO_SOURCES = [
  { id: "cinema", label: "Cinémas", sub: "01 — Sorties récentes", title: "Cette semaine en salles" },
  { id: "streaming", label: "Streaming", sub: "01 — Sorties récentes", title: "Nouveautés en streaming" },
] as const;

export type HeroSource = (typeof HERO_SOURCES)[number]["id"];

export type HeroData = {
  movies: TmdbMovie[];
  /** Logos officiels par tmdbId ; absent = on affiche le titre texte. */
  logos: Record<number, string>;
  watchlistIds: number[];
};

export async function getHeroData(userId: string, source: HeroSource): Promise<HeroData> {
  const movies = source === "streaming" ? await fetchNewOnStreaming() : await fetchNowPlaying();

  // Logos officiels + présence en watchlist, en parallèle
  const [logoEntries, watchlistEntries] = await Promise.all([
    Promise.all(movies.map(async (m) => [m.id, await fetchFilmLogo(m.id)] as const)),
    movies.length > 0
      ? prisma.userFilm.findMany({
          where: {
            userId,
            watchlist: true,
            tmdbId: { in: movies.map((m) => m.id) },
          },
          select: { tmdbId: true },
        })
      : Promise.resolve([]),
  ]);

  const logos = Object.fromEntries(
    logoEntries.filter((entry): entry is readonly [number, string] => entry[1] !== null),
  ) as Record<number, string>;

  return { movies, logos, watchlistIds: watchlistEntries.map((e) => e.tmdbId) };
}

export function heroEmptyMessage(source: HeroSource): string {
  return source === "streaming"
    ? "Aucune sortie récente disponible en abonnement pour le moment."
    : "Ajoutez TMDB_API_KEY dans .env.local pour voir les films en salle.";
}

export function formatHours(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60);
  if (h < 24) return `${h}h`;
  const days = Math.floor(h / 24);
  const rem = h % 24;
  return rem > 0 ? `${days}j ${rem}h` : `${days}j`;
}

// Group entries by calendar month — returns array of counts (oldest → newest)
function countByMonth(entries: { updatedAt: Date }[], n: number): number[] {
  const now = new Date();
  return Array.from({ length: n }, (_, i) => {
    const y = new Date(now.getFullYear(), now.getMonth() - (n - 1 - i), 1);
    return entries.filter(e => {
      const d = new Date(e.updatedAt);
      return d.getFullYear() === y.getFullYear() && d.getMonth() === y.getMonth();
    }).length;
  });
}

// Sum runtime (minutes) per 7-day window going back n weeks
function runtimeByWeek(entries: { updatedAt: Date; runtime: number | null }[], n: number): number[] {
  const now = new Date();
  return Array.from({ length: n }, (_, i) => {
    const end = new Date(now);
    end.setDate(end.getDate() - i * 7);
    const start = new Date(end);
    start.setDate(start.getDate() - 6);
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
    return entries
      .filter(e => {
        const d = new Date(e.updatedAt);
        return d >= start && d <= end && e.runtime;
      })
      .reduce((s, e) => s + (e.runtime ?? 0), 0) / 60;
  }).reverse();
}

export type RatedFilm = TmdbFilmCard & { rating: number };

export type CollectionStats = {
  count: number;
  deltaFilms: number;
  filmsByMonth: number[];
  avgRating: number | null;
  deltaRating: number;
  last10ratings: number[];
  totalMinutes: number;
  deltaHours: number;
  hoursByWeek: number[];
  filmsCeMois: number;
  deltaWeeklyFilms: number;
  filmsByWeek: number[];
};

export type CollectionData = {
  films: RatedFilm[];
  total: number;
  /** null tant qu'aucun film n'est noté : la rangée de stats est masquée. */
  stats: CollectionStats | null;
};

// Stats + collection partagent les mêmes requêtes Prisma, d'où une seule
// fonction pour ne pas dupliquer l'agrégation.
export async function getCollectionData(userId: string): Promise<CollectionData> {
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const [ratedEntries, runtimeAgg, totalRated] = await Promise.all([
    prisma.userFilm.findMany({
      where: { userId, rating: { not: null } },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.userFilm.aggregate({
      where: { userId, runtime: { not: null } },
      _sum: { runtime: true },
    }),
    prisma.userFilm.count({ where: { userId, rating: { not: null } } }),
  ]);

  // Only fetch TMDB cards for the first 24 — rest loads on demand
  const ratedSlice = ratedEntries.slice(0, 24);
  const ratedCards = await getFilmCards(ratedSlice.map((e) => e.tmdbId));
  const films = ratedSlice
    .map((entry) => {
      const card = ratedCards.get(entry.tmdbId);
      if (!card) return null;
      return { ...card, rating: entry.rating! };
    })
    .filter(Boolean) as RatedFilm[];

  if (ratedEntries.length === 0) return { films, total: totalRated, stats: null };

  const avgRating = ratedEntries.reduce((s, e) => s + (e.rating ?? 0), 0) / ratedEntries.length;

  // ——— Sparkline data ———
  // Films notés : count par mois sur 6 mois
  const filmsByMonth = countByMonth(ratedEntries, 6);
  const deltaFilms = filmsByMonth[5] - filmsByMonth[4];

  // Note moyenne : courbe des 10 derniers films (chronologique)
  const last10ratings = ratedEntries.slice(0, 10).map(e => e.rating ?? 0).reverse();
  const avgRecent = last10ratings.slice(-5).reduce((s, v) => s + v, 0) / Math.min(5, last10ratings.length);
  const avgPrev = last10ratings.slice(0, -5).reduce((s, v) => s + v, 0) / Math.max(1, last10ratings.slice(0, -5).length);
  const deltaRating = last10ratings.length >= 2 ? avgRecent - avgPrev : 0;

  // Heures cumulées : sum runtime par semaine sur 4 semaines
  const hoursByWeek = runtimeByWeek(ratedEntries, 4);
  const deltaHours = hoursByWeek[3] - hoursByWeek[2];

  // Films ce mois : count par semaine (4 semaines glissantes)
  const filmsByWeek = Array.from({ length: 4 }, (_, i) => {
    const now = new Date();
    const end = new Date(now);
    end.setDate(end.getDate() - i * 7);
    end.setHours(23, 59, 59, 999);
    const start = new Date(end);
    start.setDate(start.getDate() - 6);
    start.setHours(0, 0, 0, 0);
    return ratedEntries.filter(e => {
      const d = new Date(e.updatedAt);
      return d >= start && d <= end;
    }).length;
  }).reverse();
  const deltaWeeklyFilms = filmsByWeek[3] - filmsByWeek[2];

  const filmsCeMois = ratedEntries.filter(e => new Date(e.updatedAt) >= startOfMonth).length;

  return {
    films,
    total: totalRated,
    stats: {
      count: ratedEntries.length,
      deltaFilms,
      filmsByMonth,
      avgRating,
      deltaRating: Number(deltaRating.toFixed(1)),
      last10ratings,
      totalMinutes: runtimeAgg._sum?.runtime ?? 0,
      deltaHours: Number(deltaHours.toFixed(1)),
      hoursByWeek,
      filmsCeMois,
      deltaWeeklyFilms,
      filmsByWeek,
    },
  };
}
