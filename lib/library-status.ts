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
export type LibraryStatus = { watched: number[]; watchlist: number[] };

const EMPTY: LibraryStatus = { watched: [], watchlist: [] };

function split(rows: { tmdbId: number; watched: boolean; watchlist: boolean }[]): LibraryStatus {
  return {
    watched: rows.filter((r) => r.watched).map((r) => r.tmdbId),
    watchlist: rows.filter((r) => r.watchlist && !r.watched).map((r) => r.tmdbId),
  };
}

const SELECT = { tmdbId: true, watched: true, watchlist: true } as const;

export async function getFilmLibraryStatus(userId: string | null): Promise<LibraryStatus> {
  if (!userId) return EMPTY;
  const rows = await prisma.userFilm.findMany({
    where: { userId, OR: [{ watched: true }, { watchlist: true }] },
    select: SELECT,
  });
  return split(rows);
}

export async function getSeriesLibraryStatus(userId: string | null): Promise<LibraryStatus> {
  if (!userId) return EMPTY;
  const rows = await prisma.userSeries.findMany({
    where: { userId, OR: [{ watched: true }, { watchlist: true }] },
    select: SELECT,
  });
  return split(rows);
}
