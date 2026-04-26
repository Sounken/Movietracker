"use server";

import { getSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";

const BIO_MAX_LENGTH = 1000;

export async function updateProfile(data: {
  name?: string;
  bio?: string;
  avatarUrl?: string;
  bannerUrl?: string;
}) {
  const session = await getSession();
  if (!session) throw new Error("Non authentifié");

  const updateData = {
    ...data,
    ...(data.bio !== undefined ? { bio: data.bio.slice(0, BIO_MAX_LENGTH) } : {}),
  };

  await prisma.user.update({
    where: { id: session.userId },
    data: updateData,
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
