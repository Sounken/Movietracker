import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import { fetchSeason } from "@/lib/tmdb";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; season: string }> },
) {
  const { id, season } = await params;
  const seriesId = parseInt(id);
  const seasonNumber = parseInt(season);
  if (isNaN(seriesId) || isNaN(seasonNumber)) {
    return NextResponse.json({ episodes: [], watched: [], rating: null }, { status: 400 });
  }

  const session = await getSession();

  const [season_, watchedRows, seasonRow] = await Promise.all([
    fetchSeason(seriesId, seasonNumber),
    session
      ? prisma.userEpisode.findMany({
          where: { userId: session.userId, seriesId, seasonNumber },
          select: { episodeNumber: true },
        })
      : Promise.resolve([]),
    session
      ? prisma.userSeason.findUnique({
          where: {
            userId_seriesId_seasonNumber: { userId: session.userId, seriesId, seasonNumber },
          },
          select: { rating: true },
        })
      : Promise.resolve(null),
  ]);

  return NextResponse.json({
    episodes: season_.episodes,
    watched: watchedRows.map((r) => r.episodeNumber),
    rating: seasonRow?.rating ?? null,
  });
}
