"use server";

import { getSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";

export async function followUser(targetId: string) {
  const session = await getSession();
  if (!session) throw new Error("Non authentifié");
  if (session.userId === targetId) throw new Error("Tu ne peux pas te suivre toi-même");

  await prisma.userFollow.upsert({
    where: { followerId_followingId: { followerId: session.userId, followingId: targetId } },
    create: { followerId: session.userId, followingId: targetId },
    update: {},
  });

  revalidatePath("/friends");
}

export async function unfollowUser(targetId: string) {
  const session = await getSession();
  if (!session) throw new Error("Non authentifié");

  await prisma.userFollow.deleteMany({
    where: { followerId: session.userId, followingId: targetId },
  });

  revalidatePath("/friends");
}
