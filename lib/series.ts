import { prisma } from "@/lib/db";
import { fetchSeriesCard, fetchSeriesDetail, type TmdbSeriesCard } from "@/lib/tmdb";

type CachedSeries = {
  tmdbId: number;
  name: string;
  posterUrl: string;
  year: string;
  genres: string[];
  voteAverage: number;
};

function toCard(s: CachedSeries): TmdbSeriesCard {
  return {
    id: s.tmdbId,
    name: s.name,
    posterUrl: s.posterUrl,
    year: s.year,
    genres: s.genres,
    voteAverage: s.voteAverage,
  };
}

// Récupère la fiche série sur TMDB (détail : on en profite pour cacher le nombre
// de saisons/épisodes) puis alimente le cache local.
async function fetchAndCache(tmdbId: number): Promise<TmdbSeriesCard | null> {
  const detail = await fetchSeriesDetail(tmdbId);
  if (!detail) return fetchSeriesCard(tmdbId); // fallback léger sans écrire

  const data = {
    name: detail.name,
    posterUrl: detail.posterUrl,
    year: detail.year,
    genres: detail.genres.slice(0, 2),
    voteAverage: detail.voteAverage,
    numberOfSeasons: detail.numberOfSeasons,
    numberOfEpisodes: detail.numberOfEpisodes,
  };

  await prisma.series
    .upsert({ where: { tmdbId }, create: { tmdbId, ...data }, update: data })
    .catch(() => {});

  return { id: tmdbId, ...data, genres: data.genres };
}

// Lecture d'UNE fiche série via le cache local (TMDB seulement si absente).
export async function getSeriesCard(tmdbId: number): Promise<TmdbSeriesCard | null> {
  const cached = await prisma.series.findUnique({ where: { tmdbId } });
  if (cached) return toCard(cached);
  return fetchAndCache(tmdbId);
}

// Lecture GROUPÉE : une seule requête base pour toutes les séries demandées.
export async function getSeriesCards(
  tmdbIds: number[],
): Promise<Map<number, TmdbSeriesCard>> {
  const unique = [...new Set(tmdbIds)];
  const map = new Map<number, TmdbSeriesCard>();
  if (unique.length === 0) return map;

  const cached = await prisma.series.findMany({ where: { tmdbId: { in: unique } } });
  for (const s of cached) map.set(s.tmdbId, toCard(s));

  const missing = unique.filter((id) => !map.has(id));
  if (missing.length > 0) {
    const fetched = await Promise.all(missing.map(fetchAndCache));
    for (const card of fetched) if (card) map.set(card.id, card);
  }

  return map;
}
