"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/db";

/** Active ou coupe « me prévenir » pour un film ; renvoie le nouvel état. */
export async function toggleReminder(tmdbId: number): Promise<boolean> {
  const session = await getSession();
  if (!session) throw new Error("Non authentifié");
  if (!Number.isInteger(tmdbId) || tmdbId <= 0) throw new Error("Film inconnu");
  const where = { userId_tmdbId: { userId: session.userId, tmdbId } };

  const existing = await prisma.releaseReminder.findUnique({ where, select: { id: true } });
  if (existing) {
    await prisma.releaseReminder.delete({ where });
  } else {
    await prisma.releaseReminder.create({ data: { userId: session.userId, tmdbId } });
  }

  revalidatePath(`/film/${tmdbId}`);
  revalidatePath("/films/calendrier");
  revalidatePath("/series/calendrier");
  return !existing;
}
