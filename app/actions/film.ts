"use server";

import { getSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import { fetchFilmDetail } from "@/lib/tmdb";
import { revalidatePath } from "next/cache";

export async function saveRating(tmdbId: number, rating: number, review: string) {
  const session = await getSession();
  if (!session) throw new Error("Non authentifié");

  const existing = await prisma.userFilm.findUnique({
    where: { userId_tmdbId: { userId: session.userId, tmdbId } },
  });

  // Fetch runtime from TMDB if not already stored
  let runtime = existing?.runtime ?? null;
  if (!runtime) {
    const detail = await fetchFilmDetail(tmdbId);
    runtime = detail?.runtime ?? null;
  }

  await prisma.userFilm.upsert({
    where: { userId_tmdbId: { userId: session.userId, tmdbId } },
    update: { rating, review, watched: true, ...(runtime ? { runtime } : {}) },
    create: { userId: session.userId, tmdbId, rating, review, watched: true, runtime },
  });

  revalidatePath("/");
  revalidatePath(`/film/${tmdbId}`);
}

export async function addFilm(data: {
  tmdbId: number;
  rating: number | null;
  review: string;
  watched: boolean;
  watchedAt: string | null;
}) {
  const session = await getSession();
  if (!session) throw new Error("Non authentifié");

  const detail = await fetchFilmDetail(data.tmdbId);
  const runtime = detail?.runtime ?? null;

  await prisma.userFilm.upsert({
    where: { userId_tmdbId: { userId: session.userId, tmdbId: data.tmdbId } },
    update: {
      rating: data.rating,
      review: data.review,
      watched: data.watched,
      watchedAt: data.watchedAt ? new Date(data.watchedAt) : null,
      runtime,
    },
    create: {
      userId: session.userId,
      tmdbId: data.tmdbId,
      rating: data.rating,
      review: data.review,
      watched: data.watched,
      watchedAt: data.watchedAt ? new Date(data.watchedAt) : null,
      runtime,
    },
  });

  revalidatePath("/");
  revalidatePath(`/film/${data.tmdbId}`);
}

export async function toggleWatchlist(tmdbId: number) {
  const session = await getSession();
  if (!session) throw new Error("Non authentifié");

  const existing = await prisma.userFilm.findUnique({
    where: { userId_tmdbId: { userId: session.userId, tmdbId } },
  });

  await prisma.userFilm.upsert({
    where: { userId_tmdbId: { userId: session.userId, tmdbId } },
    update: { watchlist: !existing?.watchlist },
    create: { userId: session.userId, tmdbId, watchlist: true },
  });

  revalidatePath(`/film/${tmdbId}`);
}

export async function deleteRating(tmdbId: number) {
  const session = await getSession();
  if (!session) throw new Error("Non authentifié");

  const existing = await prisma.userFilm.findUnique({
    where: { userId_tmdbId: { userId: session.userId, tmdbId } },
  });

  if (!existing) return;

  if (!existing.watchlist && !existing.liked) {
    await prisma.userFilm.delete({
      where: { userId_tmdbId: { userId: session.userId, tmdbId } },
    });
  } else {
    await prisma.userFilm.update({
      where: { userId_tmdbId: { userId: session.userId, tmdbId } },
      data: { rating: null, review: "" },
    });
  }

  revalidatePath("/");
  revalidatePath("/profile");
  revalidatePath(`/film/${tmdbId}`);
}

export async function toggleLiked(tmdbId: number) {
  const session = await getSession();
  if (!session) throw new Error("Non authentifié");

  const existing = await prisma.userFilm.findUnique({
    where: { userId_tmdbId: { userId: session.userId, tmdbId } },
  });

  await prisma.userFilm.upsert({
    where: { userId_tmdbId: { userId: session.userId, tmdbId } },
    update: { liked: !existing?.liked },
    create: { userId: session.userId, tmdbId, liked: true },
  });

  revalidatePath(`/film/${tmdbId}`);
}
