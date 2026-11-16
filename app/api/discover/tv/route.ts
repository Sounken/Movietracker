import { NextRequest, NextResponse } from "next/server";
import { fetchDiscoverSeries } from "@/lib/tmdb";
import { fetchForYouSeries } from "@/lib/recommendations";
import { getSession } from "@/lib/session";
import { parseProviders } from "@/lib/watch-providers";
import { parseDiscoverPage, parseDiscoverParams } from "@/lib/discover-params";

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  // Filtres hors de ce que l'interface produit : refus net, sans appel TMDB.
  const { params, valid } = parseDiscoverParams((k) => sp.get(k), "tv");
  const page = parseDiscoverPage(sp.get("page"));
  if (!valid || page === null) {
    return NextResponse.json({ error: "Paramètres invalides" }, { status: 400 });
  }
  const { category, genre, minYear, maxYear, minRating, providers } = params;

  if (category === "for_you") {
    const session = await getSession();
    if (!session) return NextResponse.json([]);
    return NextResponse.json(await fetchForYouSeries(session.userId, page));
  }

  const series = await fetchDiscoverSeries(category, {
    genreId: genre ? Number(genre) : null,
    page,
    anime: params.anime,
    minYear: minYear || undefined,
    maxYear: maxYear || undefined,
    minRating: minRating ? Number(minRating) : undefined,
    providers: parseProviders(providers),
  });
  return NextResponse.json(series);
}
