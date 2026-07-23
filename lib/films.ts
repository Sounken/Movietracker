import { prisma } from "@/lib/db";
import { fetchFilmCard, type TmdbFilmCard } from "@/lib/tmdb";

type CachedFilm = {
  tmdbId: number;
  title: string;
  posterUrl: string;
  year: string;
  genres: string[];
  voteAverage: number;
};

function toCard(f: CachedFilm): TmdbFilmCard {
  return {
    id: f.tmdbId,
    title: f.title,
    posterUrl: f.posterUrl,
    year: f.year,
    genres: f.genres,
    voteAverage: f.voteAverage,
  };
}

// Récupère la fiche sur TMDB puis alimente le cache local.
// Une écriture qui échoue (course concurrente…) n'empêche jamais le rendu.
async function fetchAndCache(tmdbId: number): Promise<TmdbFilmCard | null> {
  const card = await fetchFilmCard(tmdbId);
  if (!card) return null;

  const data = {
    title: card.title,
    posterUrl: card.posterUrl,
    year: card.year,
    genres: card.genres,
    voteAverage: card.voteAverage,
  };

  await prisma.film
    .upsert({
      where: { tmdbId },
      create: { tmdbId: card.id, ...data },
      update: data,
    })
    .catch(() => {});

  return card;
}

// Lecture d'UNE fiche via le cache local (TMDB seulement si absent).
export async function getFilmCard(tmdbId: number): Promise<TmdbFilmCard | null> {
  const cached = await prisma.film.findUnique({ where: { tmdbId } });
  if (cached) return toCard(cached);
  return fetchAndCache(tmdbId);
}

// Lecture GROUPÉE : une seule requête base pour tous les films demandés,
// et TMDB uniquement pour ceux qui manquent encore au cache.
// À privilégier dès qu'on affiche une liste (évite N requêtes).
export async function getFilmCards(
  tmdbIds: number[],
): Promise<Map<number, TmdbFilmCard>> {
  const unique = [...new Set(tmdbIds)];
  const map = new Map<number, TmdbFilmCard>();
  if (unique.length === 0) return map;

  const cached = await prisma.film.findMany({ where: { tmdbId: { in: unique } } });
  for (const f of cached) map.set(f.tmdbId, toCard(f));

  const missing = unique.filter((id) => !map.has(id));
  if (missing.length > 0) {
    const fetched = await Promise.all(missing.map(fetchAndCache));
    for (const card of fetched) if (card) map.set(card.id, card);
  }

  return map;
}
