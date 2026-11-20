import "server-only";

import { prisma } from "./db";

/**
 * Titres déjà vus ou en watchlist, pour marquer les cartes de Découvrir.
 *
 * La bibliothèque entière plutôt que les seuls titres de la page : la grille
 * charge les pages suivantes côté client, et quelques milliers d'identifiants
 * restent légers à transmettre. Noter un titre le passe en « vu » et le retire
 * de la watchlist (cf. `saveRating`) : un titre n'est jamais dans les deux.
 */
export type LibraryStatus = {
  watched: number[];
  watchlist: number[];
  /** Mes notes (sur 10), affichées à côté de l'année sur les cartes. */
  ratings: Record<number, number>;
};

const EMPTY: LibraryStatus = { watched: [], watchlist: [], ratings: {} };

function split(rows: { tmdbId: number; watched: boolean; watchlist: boolean; rating: number | null }[]): LibraryStatus {
  return {
    watched: rows.filter((r) => r.watched).map((r) => r.tmdbId),
    watchlist: rows.filter((r) => r.watchlist && !r.watched).map((r) => r.tmdbId),
    ratings: Object.fromEntries(rows.filter((r) => r.rating != null).map((r) => [r.tmdbId, r.rating!])),
  };
}

const SELECT = { tmdbId: true, watched: true, watchlist: true, rating: true } as const;

export async function getFilmLibraryStatus(userId: string | null): Promise<LibraryStatus> {
  if (!userId) return EMPTY;
  const rows = await prisma.userFilm.findMany({
    where: { userId, OR: [{ watched: true }, { watchlist: true }, { rating: { not: null } }] },
    select: SELECT,
  });
  return split(rows);
}

export async function getSeriesLibraryStatus(userId: string | null): Promise<LibraryStatus> {
  if (!userId) return EMPTY;
  const rows = await prisma.userSeries.findMany({
    where: { userId, OR: [{ watched: true }, { watchlist: true }, { rating: { not: null } }] },
    select: SELECT,
  });
  return split(rows);
}
