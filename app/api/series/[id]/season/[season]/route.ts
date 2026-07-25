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
    return NextResponse.json({ episodes: [], watched: [] }, { status: 400 });
  }

  const session = await getSession();

  const [episodes, watchedRows] = await Promise.all([
    fetchSeason(seriesId, seasonNumber),
    session
      ? prisma.userEpisode.findMany({
          where: { userId: session.userId, seriesId, seasonNumber },
          select: { episodeNumber: true },
        })
      : Promise.resolve([]),
  ]);

  return NextResponse.json({
    episodes,
    watched: watchedRows.map((r) => r.episodeNumber),
  });
}
