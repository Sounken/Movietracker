"use server";

import { getSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";

// ——— Niveau série (note / avis / watchlist / like) ———

export async function saveSeriesRating(tmdbId: number, rating: number, review: string) {
  const session = await getSession();
  if (!session) throw new Error("Non authentifié");

  await prisma.userSeries.upsert({
    where: { userId_tmdbId: { userId: session.userId, tmdbId } },
    update: { rating, review, watched: true, watchlist: false },
    create: { userId: session.userId, tmdbId, rating, review, watched: true, watchlist: false },
  });

  revalidatePath("/");
  revalidatePath("/watchlist");
  revalidatePath(`/series/${tmdbId}`);
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

  revalidatePath("/watchlist");
  revalidatePath(`/series/${tmdbId}`);
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

  revalidatePath(`/series/${tmdbId}`);
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

  revalidatePath("/");
  revalidatePath("/profile");
  revalidatePath(`/series/${tmdbId}`);
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

  revalidatePath(`/series/${seriesId}`);
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

  revalidatePath(`/series/${seriesId}`);
}
