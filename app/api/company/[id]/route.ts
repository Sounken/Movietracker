import { NextRequest, NextResponse } from "next/server";
import { fetchCompanyFilms, type CompanySort } from "@/lib/tmdb";

const SORTS = new Set<CompanySort>(["recent", "oldest", "popular", "rating"]);

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const companyId = parseInt(id);
  if (isNaN(companyId)) return NextResponse.json([], { status: 400 });

  const sp = request.nextUrl.searchParams;
  const rawSort = sp.get("sort") as CompanySort | null;
  const genre = sp.get("genre");
  const minRating = sp.get("minRating");

  return NextResponse.json(
    await fetchCompanyFilms(companyId, {
      page: parseInt(sp.get("page") ?? "1"),
      // Liste blanche : `sort` est concaténé dans l'URL TMDB.
      sort: rawSort && SORTS.has(rawSort) ? rawSort : "recent",
      genreId: genre ? parseInt(genre) : null,
      minYear: sp.get("minYear") ?? undefined,
      maxYear: sp.get("maxYear") ?? undefined,
      minRating: minRating ? Number(minRating) : undefined,
      media: sp.get("media") === "tv" ? "tv" : "movie",
    }),
  );
}
