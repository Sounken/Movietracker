import { NextRequest, NextResponse } from "next/server";
import { fetchDiscover } from "@/lib/tmdb";

export async function GET(request: NextRequest) {
  const category = request.nextUrl.searchParams.get("category") ?? "popular";
  const genre = request.nextUrl.searchParams.get("genre");
  const page = parseInt(request.nextUrl.searchParams.get("page") ?? "1");
  const genreId = genre ? parseInt(genre) : null;
  const films = await fetchDiscover(category, genreId, page);
  return NextResponse.json(films);
}
