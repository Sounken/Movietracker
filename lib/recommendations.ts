import { prisma } from "@/lib/db";
import {
  GENRES,
  TV_GENRES,
  IMG,
  COMPILATION_KEYWORDS,
  weightedRating,
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

/**
 * Plancher de qualité, en note pondérée (cf. weightedRating).
 *
 * Découvrir n'excuse pas de proposer n'importe quoi. Sur les cas remontés,
 * The Electric State plafonne à 6,62, Paycheck à 6,50, Légionnaire à 6,56 —
 * tous sous ce seuil, alors qu'Oppenheimer atteint 7,76 et Everything
 * Everywhere 7,44. Le seuil laisse encore passer la moitié d'un catalogue de
 * genre populaire : il écrème, il n'assèche pas.
 */
const MIN_QUALITY = { movie: 7.0, tv: 7.0 };

/** Poids de l'écart de qualité au-dessus du plancher dans le score final. */
const QUALITY_WEIGHT = 4;

/**
 * Profil temporel : au-delà de cet écart (en années) avec l'époque que la
 * personne regarde, un titre ne reçoit plus aucun bonus de proximité.
 */
const ERA_SPAN = 25;
const ERA_WEIGHT = 4;

/** Année médiane des titres aimés — l'époque que la personne regarde vraiment. */
function medianYear(years: number[]): number | null {
  const clean = years.filter((y) => y > 1900).sort((a, b) => a - b);
  if (clean.length === 0) return null;
  const mid = Math.floor(clean.length / 2);
  return clean.length % 2 === 0 ? Math.round((clean[mid - 1] + clean[mid]) / 2) : clean[mid];
}

/**
 * Bonus de proximité d'époque, de ERA_WEIGHT (même époque) à 0 (au-delà de
 * ERA_SPAN).
 *
 * C'est volontairement un bonus et non un filtre : quelqu'un qui note surtout
 * des sorties récentes doit voir des sorties récentes, sans que Le Parrain
 * devienne pour autant impossible à recommander s'il coche tout le reste.
 * Et le repère étant la médiane de SES notes, un amateur de classiques obtient
 * exactement l'inverse.
 */
function eraBonus(year: number | null, reference: number | null): number {
  if (!year || !reference) return 0;
  const distance = Math.abs(year - reference);
  return Math.max(0, 1 - distance / ERA_SPAN) * ERA_WEIGHT;
}

function yearOf(raw: Record<string, unknown>): number | null {
  const date = (raw.release_date ?? raw.first_air_date) as string | undefined;
  const y = date ? parseInt(date.slice(0, 4)) : NaN;
  return Number.isFinite(y) ? y : null;
}

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
  /** Époque de référence : année médiane des titres que la personne a aimés. */
  referenceYear: number | null,
): Promise<RawItem[]> {
  const key = process.env.TMDB_API_KEY;
  if (!key) return [];

  const topGenres = genreIds.slice(0, 3);
  const genreQuery = topGenres.join("|"); // « | » = OU chez TMDB (« , » = ET)
  const floor = MIN_QUALITY[media];

  // Le vivier de genre est déjà filtré à la source : ce que TMDB peut écarter
  // lui-même, ce sont autant de mauvais candidats qu'on n'aura pas à noter.
  const discoverFilters =
    `&sort_by=popularity.desc&vote_count.gte=400` +
    `&without_keywords=${COMPILATION_KEYWORDS.join(",")}`;

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
                `&with_genres=${genreQuery}${discoverFilters}`,
            ),
          ),
        )
      : Promise.resolve([]),
  ]);

  const scored = new Map<number, { raw: RawItem; score: number }>();

  const add = (raw: RawItem, points: number) => {
    const id = raw.id as number;
    if (!raw.poster_path || excluded.has(id)) return;

    // Plancher de qualité, sur la note PONDÉRÉE et non sur la note brute :
    // c'est ce qui écarte à la fois les films tièdes très vus et les titres
    // obscurs à moyenne flatteuse.
    const quality = weightedRating(
      (raw.vote_average as number) ?? 0,
      (raw.vote_count as number) ?? 0,
      media,
    );
    if (quality < floor) return;

    // Affinité de genre : un titre qui coche le genre préféré vaut plus qu'un
    // titre qui n'effleure que le troisième.
    const ids = (raw.genre_ids as number[]) ?? [];
    const affinity = ids.reduce((sum, gid) => {
      const rank = topGenres.indexOf(gid);
      return rank === -1 ? sum : sum + (3 - rank);
    }, 0);

    const score =
      points +
      affinity +
      (quality - floor) * QUALITY_WEIGHT +
      eraBonus(yearOf(raw), referenceYear);

    // Un titre vu des deux côtés cumule : c'est là tout l'intérêt du croisement.
    const existing = scored.get(id);
    if (existing) existing.score += score;
    else scored.set(id, { raw, score });
  };

  // Les suggestions directes de TMDB restent le signal le plus personnel, mais
  // elles sont bruitées : leur avance sur le vivier de genre est modérée, de
  // sorte que la qualité et l'époque puissent renverser l'ordre.
  for (const list of seedLists) list.slice(0, 10).forEach((raw) => add(raw, 4));
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
    select: { tmdbId: true, genres: true, year: true },
  });
  const genresById = new Map(films.map((f) => [f.tmdbId, f.genres]));

  // Époque de référence : l'année médiane de ce que la personne aime. Quelqu'un
  // qui note surtout des sorties récentes ne doit pas se voir proposer un
  // catalogue des années 90.
  const reference = medianYear(films.map((f) => parseInt(f.year)));

  const genreIds = rankGenres(
    entries.map((e) => ({ rating: e.rating!, genres: genresById.get(e.tmdbId) ?? [] })),
    "movie",
  );

  const ranked = await buildRecommendations(
    "movie",
    entries.slice(0, SEED_COUNT).map((e) => e.tmdbId),
    genreIds,
    excluded,
    reference,
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
    select: { tmdbId: true, genres: true, year: true },
  });
  const genresById = new Map(rows.map((r) => [r.tmdbId, r.genres]));

  const reference = medianYear(rows.map((r) => parseInt(r.year)));

  const genreIds = rankGenres(
    entries.map((e) => ({ rating: e.rating!, genres: genresById.get(e.tmdbId) ?? [] })),
    "tv",
  );

  const ranked = await buildRecommendations(
    "tv",
    entries.slice(0, SEED_COUNT).map((e) => e.tmdbId),
    genreIds,
    excluded,
    reference,
  );

  return ranked.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).map((m) => ({
    id: m.id as number,
    name: (m.name as string) ?? "",
    year: typeof m.first_air_date === "string" ? m.first_air_date.slice(0, 4) : "",
    posterUrl: m.poster_path ? `${IMG}/w342${m.poster_path}` : "",
    voteAverage: m.vote_average ? Math.round((m.vote_average as number) * 10) / 10 : 0,
  }));
}
