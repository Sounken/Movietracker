import { notFound } from "next/navigation";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import { fetchFilmCard } from "@/lib/tmdb";
import ListDetailClient from "./ListDetailClient";

export default async function ListDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session) notFound();

  const list = await prisma.userList.findFirst({
    where: { id, userId: session.userId },
    include: { films: { orderBy: { addedAt: "asc" } } },
  });

  if (!list) notFound();

  const films = (
    await Promise.all(
      list.films.map(async (f) => {
        const card = await fetchFilmCard(f.tmdbId);
        if (!card) return null;
        return { id: card.id, title: card.title, posterUrl: card.posterUrl, year: card.year, tmdbId: f.tmdbId };
      }),
    )
  ).filter(Boolean) as Array<{ id: number; title: string; posterUrl: string; year: string; tmdbId: number }>;

  return (
    <ListDetailClient
      list={{
        id: list.id,
        name: list.name,
        description: list.description,
        emoji: list.emoji,
        color: list.color,
        filmCount: list.films.length,
        createdAt: list.createdAt.toISOString(),
      }}
      films={films}
    />
  );
}
