import { prisma } from "@/lib/db";
import { fetchFilmCard, type TmdbFilmCard } from "@/lib/tmdb";

// Lecture d'une fiche film via le cache local (table Film).
// TMDB n'est appelé QUE si le film n'est pas encore en cache — sinon une seule
// lecture DB (clé primaire) remplace un appel réseau TMDB à chaque rendu.
export async function getFilmCard(tmdbId: number): Promise<TmdbFilmCard | null> {
  const cached = await prisma.film.findUnique({ where: { tmdbId } });
  if (cached) {
    return {
      id: cached.tmdbId,
      title: cached.title,
      posterUrl: cached.posterUrl,
      year: cached.year,
      genres: cached.genres,
      voteAverage: cached.voteAverage,
    };
  }

  const card = await fetchFilmCard(tmdbId);
  if (!card) return null;

  // Alimente le cache. En cas d'échec d'écriture (course concurrente, etc.),
  // on n'empêche jamais le rendu de la page.
  await prisma.film
    .upsert({
      where: { tmdbId },
      create: {
        tmdbId: card.id,
        title: card.title,
        posterUrl: card.posterUrl,
        year: card.year,
        genres: card.genres,
        voteAverage: card.voteAverage,
      },
      update: {
        title: card.title,
        posterUrl: card.posterUrl,
        year: card.year,
        genres: card.genres,
        voteAverage: card.voteAverage,
      },
    })
    .catch(() => {});

  return card;
}
