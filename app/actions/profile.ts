"use server";

import { getSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";

export async function updateProfile(data: {
  name?: string;
  bio?: string;
  avatarUrl?: string;
  bannerUrl?: string;
}) {
  const session = await getSession();
  if (!session) throw new Error("Non authentifié");

  await prisma.user.update({
    where: { id: session.userId },
    data,
  });

  revalidatePath("/profile");
}

export async function setFavoriteFilm(position: 1 | 2 | 3 | 4, tmdbId: number | null) {
  const session = await getSession();
  if (!session) throw new Error("Non authentifié");

  if (tmdbId === null) {
    await prisma.userFavoriteFilm.deleteMany({
      where: { userId: session.userId, position },
    });
  } else {
    // Remove the film from any other slot first (avoids @@unique([userId, tmdbId]) violation)
    await prisma.userFavoriteFilm.deleteMany({
      where: { userId: session.userId, tmdbId, NOT: { position } },
    });
    await prisma.userFavoriteFilm.upsert({
      where: { userId_position: { userId: session.userId, position } },
      update: { tmdbId },
      create: { userId: session.userId, tmdbId, position },
    });
  }

  revalidatePath("/profile");
}
