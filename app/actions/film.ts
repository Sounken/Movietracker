"use server";

import { getSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import { fetchFilmDetail } from "@/lib/tmdb";
import { revalidatePath } from "next/cache";

// Toutes les pages « monde Films » qui affichent la collection de l'utilisateur.
// `/` n'existe plus (redirigé vers /films par next.config), il fallait donc
// invalider les vraies routes — sinon la page restait en cache et il fallait
// rafraîchir à la main après chaque ajout/notation.
function revalidateFilmPages(tmdbId: number) {
  revalidatePath("/films");
  revalidatePath("/films/profile");
  revalidatePath("/films/watchlist");
  revalidatePath("/films/favorites");
  revalidatePath("/films/lists");
  revalidatePath(`/film/${tmdbId}`);
}

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

  // Noter un film = film vu → on le retire de la watchlist (« à voir »).
  await prisma.userFilm.upsert({
    where: { userId_tmdbId: { userId: session.userId, tmdbId } },
    update: { rating, review, watched: true, watchlist: false, ...(runtime ? { runtime } : {}) },
    create: { userId: session.userId, tmdbId, rating, review, watched: true, watchlist: false, runtime },
  });

  revalidateFilmPages(tmdbId);
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
      // Un film noté n'est plus « à voir » : on le sort de la watchlist.
      ...(data.rating != null ? { watchlist: false } : {}),
    },
    create: {
      userId: session.userId,
      tmdbId: data.tmdbId,
      rating: data.rating,
      review: data.review,
      watched: data.watched,
      watchedAt: data.watchedAt ? new Date(data.watchedAt) : null,
      runtime,
      ...(data.rating != null ? { watchlist: false } : {}),
    },
  });

  revalidateFilmPages(data.tmdbId);
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

  revalidateFilmPages(tmdbId);
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

  revalidateFilmPages(tmdbId);
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

  revalidateFilmPages(tmdbId);
}
