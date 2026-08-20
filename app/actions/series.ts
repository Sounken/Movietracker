"use server";

import { getSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";

// Mêmes anciennes routes que pour les films : `/`, `/watchlist` et `/profile`
// n'existent plus depuis la scission Films / Séries, elles ne revalidaient
// donc plus rien et les pages restaient en cache.
function revalidateSeriesPages(tmdbId?: number) {
  revalidatePath("/series");
  revalidatePath("/series/profile");
  revalidatePath("/series/watchlist");
  revalidatePath("/series/favorites");
  if (tmdbId !== undefined) revalidatePath(`/series/${tmdbId}`);
}

// ——— Niveau série (note / avis / watchlist / like) ———

export async function saveSeriesRating(tmdbId: number, rating: number, review: string) {
  const session = await getSession();
  if (!session) throw new Error("Non authentifié");

  await prisma.userSeries.upsert({
    where: { userId_tmdbId: { userId: session.userId, tmdbId } },
    update: { rating, review, watched: true, watchlist: false },
    create: { userId: session.userId, tmdbId, rating, review, watched: true, watchlist: false },
  });

  revalidateSeriesPages(tmdbId);
}

export async function toggleSeriesWatchlist(tmdbId: number) {
  const session = await getSession();
  if (!session) throw new Error("Non authentifié");

  const existing = await prisma.userSeries.findUnique({
    where: { userId_tmdbId: { userId: session.userId, tmdbId } },
  });

  await prisma.userSeries.upsert({
    where: { userId_tmdbId: { userId: session.userId, tmdbId } },
    update: { watchlist: !existing?.watchlist },
    create: { userId: session.userId, tmdbId, watchlist: true },
  });

  revalidateSeriesPages(tmdbId);
}

export async function toggleSeriesLiked(tmdbId: number) {
  const session = await getSession();
  if (!session) throw new Error("Non authentifié");

  const existing = await prisma.userSeries.findUnique({
    where: { userId_tmdbId: { userId: session.userId, tmdbId } },
  });

  await prisma.userSeries.upsert({
    where: { userId_tmdbId: { userId: session.userId, tmdbId } },
    update: { liked: !existing?.liked },
    create: { userId: session.userId, tmdbId, liked: true },
  });

  revalidateSeriesPages(tmdbId);
}

export async function deleteSeriesRating(tmdbId: number) {
  const session = await getSession();
  if (!session) throw new Error("Non authentifié");

  const existing = await prisma.userSeries.findUnique({
    where: { userId_tmdbId: { userId: session.userId, tmdbId } },
  });
  if (!existing) return;

  if (!existing.watchlist && !existing.liked) {
    await prisma.userSeries.delete({
      where: { userId_tmdbId: { userId: session.userId, tmdbId } },
    });
  } else {
    await prisma.userSeries.update({
      where: { userId_tmdbId: { userId: session.userId, tmdbId } },
      data: { rating: null, review: "" },
    });
  }

  revalidateSeriesPages(tmdbId);
}

// ——— Séries préférées (4 emplacements épinglés sur le profil) ———

export async function setFavoriteSeries(position: 1 | 2 | 3 | 4, tmdbId: number | null) {
  const session = await getSession();
  if (!session) throw new Error("Non authentifié");

  if (tmdbId === null) {
    await prisma.userFavoriteSeries.deleteMany({
      where: { userId: session.userId, position },
    });
  } else {
    // Retire la série d'un autre emplacement d'abord (contrainte @@unique tmdbId)
    await prisma.userFavoriteSeries.deleteMany({
      where: { userId: session.userId, tmdbId, NOT: { position } },
    });
    await prisma.userFavoriteSeries.upsert({
      where: { userId_position: { userId: session.userId, position } },
      update: { tmdbId },
      create: { userId: session.userId, tmdbId, position },
    });
  }

  revalidatePath("/series/profile");
}

// ——— Niveau épisode ———

// S'assure qu'une ligne UserSeries existe (regarder un épisode = commencer la série).
async function ensureUserSeries(userId: string, seriesId: number) {
  await prisma.userSeries.upsert({
    where: { userId_tmdbId: { userId, tmdbId: seriesId } },
    update: { watched: true, watchlist: false },
    create: { userId, tmdbId: seriesId, watched: true },
  });
}

export async function toggleEpisode(
  seriesId: number,
  seasonNumber: number,
  episodeNumber: number,
  runtime: number | null,
) {
  const session = await getSession();
  if (!session) throw new Error("Non authentifié");

  const key = {
    userId_seriesId_seasonNumber_episodeNumber: {
      userId: session.userId,
      seriesId,
      seasonNumber,
      episodeNumber,
    },
  };
  const existing = await prisma.userEpisode.findUnique({ where: key });

  if (existing) {
    await prisma.userEpisode.delete({ where: key });
  } else {
    await prisma.userEpisode.create({
      data: { userId: session.userId, seriesId, seasonNumber, episodeNumber, runtime },
    });
    await ensureUserSeries(session.userId, seriesId);
  }

  revalidateSeriesPages(seriesId);
}

// Marque (ou démarque) toute une saison d'un coup.
export async function setSeasonWatched(
  seriesId: number,
  seasonNumber: number,
  episodes: { episodeNumber: number; runtime: number | null }[],
  watched: boolean,
) {
  const session = await getSession();
  if (!session) throw new Error("Non authentifié");

  if (watched) {
    await prisma.userEpisode.createMany({
      data: episodes.map((e) => ({
        userId: session.userId,
        seriesId,
        seasonNumber,
        episodeNumber: e.episodeNumber,
        runtime: e.runtime,
      })),
      skipDuplicates: true,
    });
    await ensureUserSeries(session.userId, seriesId);
  } else {
    await prisma.userEpisode.deleteMany({
      where: { userId: session.userId, seriesId, seasonNumber },
    });
  }

  revalidateSeriesPages(seriesId);
}

// ——— Note par saison ———

/**
 * Enregistre la note d'une saison (sur 10, demi-points compris).
 * `rating` à null retire la note.
 */
export async function saveSeasonRating(
  seriesId: number,
  seasonNumber: number,
  rating: number | null,
) {
  const session = await getSession();
  if (!session) throw new Error("Non authentifié");

  if (rating === null) {
    await prisma.userSeason.deleteMany({
      where: { userId: session.userId, seriesId, seasonNumber },
    });
  } else {
    // Borné côté serveur : le client ne doit pas pouvoir enregistrer 42/10.
    const bounded = Math.min(10, Math.max(0.5, rating));
    await prisma.userSeason.upsert({
      where: {
        userId_seriesId_seasonNumber: { userId: session.userId, seriesId, seasonNumber },
      },
      update: { rating: bounded },
      create: { userId: session.userId, seriesId, seasonNumber, rating: bounded },
    });
    // Noter une saison, c'est suivre la série.
    await ensureUserSeries(session.userId, seriesId);
  }

  revalidateSeriesPages(seriesId);
}
