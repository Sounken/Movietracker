import { NextRequest, NextResponse } from "next/server";
import { fetchDiscoverSeries } from "@/lib/tmdb";

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const category = sp.get("category") ?? "popular";
  const genre = sp.get("genre");
  const page = parseInt(sp.get("page") ?? "1");
  const anime = sp.get("anime") === "1";
  const genreId = genre ? parseInt(genre) : null;
  const series = await fetchDiscoverSeries(category, genreId, page, anime);
  return NextResponse.json(series);
}
