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
  /** Échelle d'affichage des notes : 10 ou 100. */
  ratingScale?: number;
}) {
  const session = await getSession();
  if (!session) throw new Error("Non authentifié");

  const updateData = {
    ...data,
    ...(data.bio !== undefined ? { bio: data.bio.slice(0, BIO_MAX_LENGTH) } : {}),
    // Toute autre valeur est ignorée : la colonne n'accepte que 10 ou 100.
    ...(data.ratingScale !== undefined
      ? { ratingScale: data.ratingScale === 100 ? 100 : 10 }
      : {}),
  };

  await prisma.user.update({
    where: { id: session.userId },
    data: updateData,
  });

  // Le nom et l'avatar sont affichés par la sidebar, donc par le LAYOUT, sur
  // toutes les pages : revalider seulement les pages profil laissait l'ancien
  // avatar partout ailleurs. Idem pour l'échelle de notation.
  revalidatePath("/", "layout");
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

  revalidatePath("/films/profile");
  revalidatePath("/series/profile");
}
