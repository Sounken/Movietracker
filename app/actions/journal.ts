"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import { fetchFilmDetail } from "@/lib/tmdb";
import { parseWatchDate, syncLatestWatch, WATCH_NOTE_MAX_LENGTH } from "@/lib/journal";

function revalidateJournal(tmdbId: number) {
  revalidatePath("/films");
  revalidatePath("/films/journal");
  revalidatePath("/films/profile");
  revalidatePath("/films/watchlist");
  revalidatePath(`/film/${tmdbId}`);
}

/**
 * Ajoute un visionnage au journal : « vu aujourd'hui », « vu le… » ou
 * « j'ai revu ce film ».
 *
 * Le film passe vu et sort de « À voir », comme quand on le note.
 */
export async function logFilmWatch(tmdbId: number, date: string, note: string = "") {
  const session = await getSession();
  if (!session) throw new Error("Non authentifié");
  const watchedAt = parseWatchDate(date);
  if (!watchedAt) throw new Error("Date invalide");
  const userId = session.userId;

  const existing = await prisma.userFilm.findUnique({
    where: { userId_tmdbId: { userId, tmdbId } },
    select: { runtime: true },
  });
  // La durée alimente les statistiques (heures vues) : on la récupère une fois.
  const runtime = existing?.runtime ?? (await fetchFilmDetail(tmdbId))?.runtime ?? null;

  await prisma.$transaction([
    prisma.userFilm.upsert({
      where: { userId_tmdbId: { userId, tmdbId } },
      update: { watched: true, watchlist: false, ...(runtime ? { runtime } : {}) },
      create: { userId, tmdbId, watched: true, runtime },
    }),
    prisma.filmWatch.create({
      data: {
        userId,
        tmdbId,
        watchedAt,
        note: note.trim().slice(0, WATCH_NOTE_MAX_LENGTH) || null,
      },
    }),
  ]);
  await syncLatestWatch(userId, tmdbId);
  revalidateJournal(tmdbId);
}

/** Retire une ligne du journal. Le film reste vu et noté. */
export async function deleteFilmWatch(id: string) {
  const session = await getSession();
  if (!session) throw new Error("Non authentifié");

  const watch = await prisma.filmWatch.findFirst({
    where: { id, userId: session.userId },
    select: { tmdbId: true },
  });
  if (!watch) return;

  await prisma.filmWatch.delete({ where: { id } });
  await syncLatestWatch(session.userId, watch.tmdbId);
  revalidateJournal(watch.tmdbId);
}
