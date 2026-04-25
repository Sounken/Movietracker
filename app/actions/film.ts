"use server";

import { getSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";

export async function saveRating(tmdbId: number, rating: number, review: string) {
  const session = await getSession();
  if (!session) throw new Error("Non authentifié");

  await prisma.userFilm.upsert({
    where: { userId_tmdbId: { userId: session.userId, tmdbId } },
    update: { rating, review },
    create: { userId: session.userId, tmdbId, rating, review },
  });

  revalidatePath("/");
  revalidatePath(`/film/${tmdbId}`);
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
