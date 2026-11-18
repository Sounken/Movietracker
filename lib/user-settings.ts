import "server-only";
import { cache } from "react";
import { prisma } from "@/lib/db";

/**
 * Plateformes de l'utilisateur connecté, ou liste vide.
 *
 * Mis en cache pour la requête : la fiche et ses blocs la lisent chacun de
 * leur côté.
 */
export const getUserWatchProviders = cache(async (userId: string | null | undefined) => {
  if (!userId) return [];
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { watchProviders: true },
  });
  return user?.watchProviders ?? [];
});
