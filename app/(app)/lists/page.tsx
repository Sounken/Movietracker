import { notFound } from "next/navigation";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import { fetchFilmCard } from "@/lib/tmdb";
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

  const listsWithPosters = await Promise.all(
    lists.map(async (list) => {
      const posters = (
        await Promise.all(
          list.films.map(async (f) => {
            const card = await fetchFilmCard(f.tmdbId);
            return card?.posterUrl ?? null;
          }),
        )
      ).filter(Boolean) as string[];
      return {
        id: list.id,
        name: list.name,
        description: list.description,
        emoji: list.emoji,
        color: list.color,
        filmCount: list._count.films,
        posters,
      };
    }),
  );

  return <ListsClient lists={listsWithPosters} />;
}
