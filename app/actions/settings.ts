"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import { parseProviders } from "@/lib/watch-providers";

/** Enregistre les plateformes auxquelles l'utilisateur est abonné. */
export async function updateWatchProviders(ids: number[]) {
  const session = await getSession();
  if (!session) throw new Error("Non authentifié");

  // Même liste blanche que l'URL de Découvrir : un identifiant inconnu finirait
  // dans une requête TMDB.
  const providers = parseProviders(ids.join(",")) ?? [];

  await prisma.user.update({
    where: { id: session.userId },
    data: { watchProviders: [...new Set(providers)] },
  });

  // Découvrir et les fiches lisent la sélection au rendu.
  revalidatePath("/", "layout");
}

export type PushPreferences = {
  pushAvailable: boolean;
  pushReleases: boolean;
  pushSocial: boolean;
  pushFriends: boolean;
};

/** Enregistre les catégories de notifications push voulues. */
export async function updatePushPreferences(prefs: Partial<PushPreferences>) {
  const session = await getSession();
  if (!session) throw new Error("Non authentifié");

  // Seules les quatre clés connues, et seulement des booléens.
  const keys = ["pushAvailable", "pushReleases", "pushSocial", "pushFriends"] as const;
  const data = Object.fromEntries(
    keys.filter((k) => typeof prefs[k] === "boolean").map((k) => [k, prefs[k]]),
  );
  await prisma.user.update({ where: { id: session.userId }, data });
}
