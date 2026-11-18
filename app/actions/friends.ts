"use server";

import { getSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { sendPushes } from "@/lib/push";

export async function followUser(targetId: string) {
  const session = await getSession();
  if (!session) throw new Error("Non authentifié");
  if (session.userId === targetId) throw new Error("Tu ne peux pas te suivre toi-même");

  /**
   * L'abonnement et la notification partent ensemble : sans transaction, un
   * échec entre les deux laisserait un abonné dont personne n'est prévenu.
   *
   * La notification est réutilisée si elle existe déjà (se désabonner puis se
   * réabonner ne doit pas empiler les lignes) et redevient non lue, avec une
   * date remise à maintenant pour qu'elle remonte en tête de liste.
   */
  await prisma.$transaction([
    prisma.userFollow.upsert({
      where: { followerId_followingId: { followerId: session.userId, followingId: targetId } },
      create: { followerId: session.userId, followingId: targetId },
      update: {},
    }),
    prisma.notification.upsert({
      where: {
        userId_actorId_type: { userId: targetId, actorId: session.userId, type: "follow" },
      },
      create: { userId: targetId, actorId: session.userId, type: "follow" },
      update: { readAt: null, createdAt: new Date() },
    }),
  ]);

  const actor = session.name ?? "Quelqu'un";
  after(() =>
    sendPushes([
      {
        userId: targetId,
        category: "social",
        payload: { title: "Nouvel abonné", body: `${actor} s'est abonné à vous.`, url: `/user/${session.userId}` },
      },
    ]),
  );

  revalidatePath("/friends");
}

export async function unfollowUser(targetId: string) {
  const session = await getSession();
  if (!session) throw new Error("Non authentifié");

  // La notification déjà reçue n'est pas retirée : elle relate un fait passé,
  // et la faire disparaître donnerait l'impression d'un bug côté destinataire.
  await prisma.userFollow.deleteMany({
    where: { followerId: session.userId, followingId: targetId },
  });

  revalidatePath("/friends");
}
