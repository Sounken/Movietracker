import { NextRequest, NextResponse } from "next/server";
import { fetchDiscoverSeries } from "@/lib/tmdb";
import { fetchForYouSeries } from "@/lib/recommendations";
import { getSession } from "@/lib/session";

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const category = sp.get("category") ?? "popular";
  const genre = sp.get("genre");
  const minRating = sp.get("minRating");
  const page = parseInt(sp.get("page") ?? "1");

  if (category === "for_you") {
    const session = await getSession();
    if (!session) return NextResponse.json([]);
    return NextResponse.json(await fetchForYouSeries(session.userId, page));
  }

  const series = await fetchDiscoverSeries(category, {
    genreId: genre ? parseInt(genre) : null,
    page,
    anime: sp.get("anime") === "1",
    minYear: sp.get("minYear") ?? undefined,
    maxYear: sp.get("maxYear") ?? undefined,
    minRating: minRating ? Number(minRating) : undefined,
  });
  return NextResponse.json(series);
}
