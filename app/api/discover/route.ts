import { NextRequest, NextResponse } from "next/server";
import { fetchDiscover } from "@/lib/tmdb";
import { fetchForYouFilms } from "@/lib/recommendations";
import { getSession } from "@/lib/session";

export async function GET(request: NextRequest) {
  const p = request.nextUrl.searchParams;
  const category = p.get("category") ?? "popular";
  const genre = p.get("genre");
  const minRating = p.get("minRating");
  const page = parseInt(p.get("page") ?? "1");

  // Recommandations personnelles : hors session, il n'y a rien à recommander.
  if (category === "for_you") {
    const session = await getSession();
    if (!session) return NextResponse.json([]);
    return NextResponse.json(await fetchForYouFilms(session.userId, page));
  }

  const films = await fetchDiscover(category, {
    genreId: genre ? parseInt(genre) : null,
    page,
    minYear: p.get("minYear") ?? undefined,
    maxYear: p.get("maxYear") ?? undefined,
    minRating: minRating ? Number(minRating) : undefined,
  });
  return NextResponse.json(films);
}
