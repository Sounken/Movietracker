import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import { fetchFilmCard } from "@/lib/tmdb";

const PAGE_SIZE = 24;

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ films: [], total: 0 }, { status: 401 });

  const { searchParams } = req.nextUrl;
  const type = searchParams.get("type") ?? "watched";
  const skip = parseInt(searchParams.get("skip") ?? "0");
  const take = parseInt(searchParams.get("take") ?? String(PAGE_SIZE));

  const filterMap: Record<string, object> = {
    watched: { watched: true },
    liked: { liked: true },
    watchlist: { watchlist: true },
    rated: { rating: { not: null } },
    all: {},
  };
  const filter = filterMap[type] ?? { watched: true };

  const [total, entries] = await Promise.all([
    prisma.userFilm.count({ where: { userId: session.userId, ...filter } }),
    prisma.userFilm.findMany({
      where: { userId: session.userId, ...filter },
      orderBy: { updatedAt: "desc" },
      skip,
      take,
      select: { tmdbId: true, rating: true },
    }),
  ]);

  const films = (
    await Promise.all(
      entries.map(async (entry) => {
        const card = await fetchFilmCard(entry.tmdbId);
        if (!card) return null;
        return { ...card, rating: entry.rating ?? null };
      })
    )
  ).filter(Boolean);

  return NextResponse.json({ films, total });
}
