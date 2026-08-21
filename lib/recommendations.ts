import { prisma } from "@/lib/db";
import {
  GENRES,
  TV_GENRES,
  IMG,
  type TmdbDiscoverFilm,
  type TmdbDiscoverSeries,
} from "@/lib/tmdb";

const BASE = "https://api.themoviedb.org/3";
const PAGE_SIZE = 20;

// Nombre de titres notés dont on tire les recommandations TMDB directes.
// Au-delà, on paie des appels réseau pour des goûts déjà couverts par les genres.
const SEED_COUNT = 6;
// En dessous de cette note (sur 10) un titre ne dit pas ce qu'on aime.
const LIKED_THRESHOLD = 7;
// Il faut un minimum de matière pour que le profil de goûts veuille dire quelque chose.
const MIN_RATINGS = 3;

// Le cache local stocke les genres en clair (« Science-Fiction ») alors que
// l'API TMDB les filtre par identifiant : on inverse la table de correspondance.
// Films et séries ont des nomenclatures distinctes, d'où deux tables.
const invert = (table: Record<number, string>): Record<string, number> =>
  Object.fromEntries(Object.entries(table).map(([id, name]) => [name, Number(id)]));

const MOVIE_GENRE_IDS = invert(GENRES);
const TV_GENRE_IDS = invert(TV_GENRES);

/** Profil de goûts : identifiants de genres, du plus aimé au moins. */
function rankGenres(
  entries: Array<{ rating: number; genres: string[] }>,
  media: "movie" | "tv",
): number[] {
  const table = media === "movie" ? MOVIE_GENRE_IDS : TV_GENRE_IDS;
  const weights = new Map<number, number>();
  for (const { rating, genres } of entries) {
    // Une note de 7 pèse 1, une note de 10 pèse 4 : les coups de cœur
    // orientent le profil bien plus que les films simplement corrects.
    const weight = rating - LIKED_THRESHOLD + 1;
    for (const name of genres) {
      const id = table[name];
      if (id) weights.set(id, (weights.get(id) ?? 0) + weight);
    }
  }
  return [...weights.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([id]) => id);
}

type RawItem = Record<string, unknown>;

async function tmdbJson(url: string): Promise<RawItem[]> {
  try {
    const res = await fetch(url, { next: { revalidate: 3600 } });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.results ?? []) as RawItem[];
  } catch {
    return [];
  }
}

/**
 * Fusionne deux angles de recommandation :
 *
 *  1. les titres que TMDB associe aux mieux notés de l'utilisateur — précis,
 *     mais enfermant : on retombe vite sur les mêmes sagas ;
 *  2. les titres populaires des genres qu'il plébiscite — plus large, il fait
 *     entrer des titres qu'aucun de ses films ne pointe directement.
 *
 * Un titre qui remonte des deux côtés obtient le meilleur score : c'est le
 * signal le plus fiable dont on dispose.
 */
async function buildRecommendations(
  media: "movie" | "tv",
  seedIds: number[],
  genreIds: number[],
  excluded: Set<number>,
): Promise<RawItem[]> {
  const key = process.env.TMDB_API_KEY;
  if (!key) return [];

  const topGenres = genreIds.slice(0, 3);
  const genreQuery = topGenres.join("|"); // « | » = OU chez TMDB (« , » = ET)

  const [seedLists, genreLists] = await Promise.all([
    Promise.all(
      seedIds.map((id) =>
        tmdbJson(`${BASE}/${media}/${id}/recommendations?api_key=${key}&language=fr-FR&page=1`),
      ),
    ),
    genreQuery
      ? Promise.all(
          [1, 2].map((page) =>
            tmdbJson(
              `${BASE}/discover/${media}?api_key=${key}&language=fr-FR&page=${page}` +
                `&with_genres=${genreQuery}&sort_by=popularity.desc&vote_count.gte=200`,
            ),
          ),
        )
      : Promise.resolve([]),
  ]);

  const scored = new Map<number, { raw: RawItem; score: number }>();

  const add = (raw: RawItem, points: number) => {
    const id = raw.id as number;
    if (!raw.poster_path || excluded.has(id)) return;

    // Affinité de genre : un titre qui coche le genre préféré vaut plus qu'un
    // titre qui n'effleure que le troisième.
    const ids = (raw.genre_ids as number[]) ?? [];
    const affinity = ids.reduce((sum, gid) => {
      const rank = topGenres.indexOf(gid);
      return rank === -1 ? sum : sum + (3 - rank);
    }, 0);

    const existing = scored.get(id);
    const score = points + affinity + (raw.vote_average as number) / 2;
    // Un titre vu des deux côtés cumule : c'est là tout l'intérêt du croisement.
    if (existing) existing.score += score;
    else scored.set(id, { raw, score });
  };

  for (const list of seedLists) list.slice(0, 10).forEach((raw) => add(raw, 6));
  for (const list of genreLists) list.forEach((raw) => add(raw, 2));

  return [...scored.values()].sort((a, b) => b.score - a.score).map((s) => s.raw);
}

/** Films recommandés pour l'utilisateur, paginés. Vide si trop peu de notes. */
export async function fetchForYouFilms(
  userId: string,
  page: number = 1,
): Promise<TmdbDiscoverFilm[]> {
  const entries = await prisma.userFilm.findMany({
    where: { userId, rating: { gte: LIKED_THRESHOLD } },
    orderBy: [{ rating: "desc" }, { updatedAt: "desc" }],
    select: { tmdbId: true, rating: true },
  });
  if (entries.length < MIN_RATINGS) return [];

  // Tout ce que l'utilisateur a déjà noté ou mis de côté sort des suggestions :
  // recommander un film déjà vu n'apporte rien.
  const known = await prisma.userFilm.findMany({
    where: { userId },
    select: { tmdbId: true },
  });
  const excluded = new Set(known.map((k) => k.tmdbId));

  const films = await prisma.film.findMany({
    where: { tmdbId: { in: entries.map((e) => e.tmdbId) } },
    select: { tmdbId: true, genres: true },
  });
  const genresById = new Map(films.map((f) => [f.tmdbId, f.genres]));

  const genreIds = rankGenres(
    entries.map((e) => ({ rating: e.rating!, genres: genresById.get(e.tmdbId) ?? [] })),
    "movie",
  );

  const ranked = await buildRecommendations(
    "movie",
    entries.slice(0, SEED_COUNT).map((e) => e.tmdbId),
    genreIds,
    excluded,
  );

  return ranked.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).map((m) => ({
    id: m.id as number,
    title: (m.title as string) ?? "",
    year: typeof m.release_date === "string" ? m.release_date.slice(0, 4) : "",
    posterUrl: m.poster_path ? `${IMG}/w342${m.poster_path}` : "",
    voteAverage: m.vote_average ? Math.round((m.vote_average as number) * 10) / 10 : 0,
  }));
}

/** Équivalent séries de `fetchForYouFilms`. */
export async function fetchForYouSeries(
  userId: string,
  page: number = 1,
): Promise<TmdbDiscoverSeries[]> {
  const entries = await prisma.userSeries.findMany({
    where: { userId, rating: { gte: LIKED_THRESHOLD } },
    orderBy: [{ rating: "desc" }, { updatedAt: "desc" }],
    select: { tmdbId: true, rating: true },
  });
  if (entries.length < MIN_RATINGS) return [];

  const known = await prisma.userSeries.findMany({
    where: { userId },
    select: { tmdbId: true },
  });
  const excluded = new Set(known.map((k) => k.tmdbId));

  const rows = await prisma.series.findMany({
    where: { tmdbId: { in: entries.map((e) => e.tmdbId) } },
    select: { tmdbId: true, genres: true },
  });
  const genresById = new Map(rows.map((r) => [r.tmdbId, r.genres]));

  const genreIds = rankGenres(
    entries.map((e) => ({ rating: e.rating!, genres: genresById.get(e.tmdbId) ?? [] })),
    "tv",
  );

  const ranked = await buildRecommendations(
    "tv",
    entries.slice(0, SEED_COUNT).map((e) => e.tmdbId),
    genreIds,
    excluded,
  );

  return ranked.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).map((m) => ({
    id: m.id as number,
    name: (m.name as string) ?? "",
    year: typeof m.first_air_date === "string" ? m.first_air_date.slice(0, 4) : "",
    posterUrl: m.poster_path ? `${IMG}/w342${m.poster_path}` : "",
    voteAverage: m.vote_average ? Math.round((m.vote_average as number) * 10) / 10 : 0,
  }));
}
