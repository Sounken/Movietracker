"use server";

import { getSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";

export async function createList(data: { name: string; description?: string; emoji?: string; color?: string }) {
  const session = await getSession();
  if (!session) throw new Error("Non authentifié");

  const list = await prisma.userList.create({
    data: { userId: session.userId, ...data },
  });

  revalidatePath("/lists");
  return list;
}

export async function updateList(id: string, data: { name?: string; description?: string; emoji?: string; color?: string }) {
  const session = await getSession();
  if (!session) throw new Error("Non authentifié");

  await prisma.userList.updateMany({
    where: { id, userId: session.userId },
    data,
  });

  revalidatePath("/lists");
  revalidatePath(`/lists/${id}`);
}

export async function deleteList(id: string) {
  const session = await getSession();
  if (!session) throw new Error("Non authentifié");

  await prisma.userList.deleteMany({
    where: { id, userId: session.userId },
  });

  revalidatePath("/lists");
}

export async function addFilmToList(listId: string, tmdbId: number) {
  const session = await getSession();
  if (!session) throw new Error("Non authentifié");

  const list = await prisma.userList.findFirst({
    where: { id: listId, userId: session.userId },
  });
  if (!list) throw new Error("Liste introuvable");

  await prisma.userListFilm.upsert({
    where: { listId_tmdbId: { listId, tmdbId } },
    create: { listId, tmdbId },
    update: {},
  });

  revalidatePath(`/lists/${listId}`);
}

export async function removeFilmFromList(listId: string, tmdbId: number) {
  const session = await getSession();
  if (!session) throw new Error("Non authentifié");

  const list = await prisma.userList.findFirst({
    where: { id: listId, userId: session.userId },
  });
  if (!list) throw new Error("Liste introuvable");

  await prisma.userListFilm.deleteMany({
    where: { listId, tmdbId },
  });

  revalidatePath(`/lists/${listId}`);
}
