import { notFound } from "next/navigation";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import { getFilmCards } from "@/lib/films";
import ListsClient from "./ListsClient";

export default async function ListsPage() {
  const session = await getSession();
  if (!session) notFound();

  const lists = await prisma.userList.findMany({
    where: { userId: session.userId },
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { films: true } },
      films: { orderBy: { addedAt: "asc" }, take: 3 },
    },
  });

  const cards = await getFilmCards(lists.flatMap((list) => list.films.map((f) => f.tmdbId)));

  const listsWithPosters = lists.map((list) => ({
    id: list.id,
    name: list.name,
    description: list.description,
    emoji: list.emoji,
    color: list.color,
    filmCount: list._count.films,
    posters: list.films
      .map((f) => cards.get(f.tmdbId)?.posterUrl ?? null)
      .filter(Boolean) as string[],
  }));

  return <ListsClient lists={listsWithPosters} />;
}
