import { NextRequest, NextResponse } from "next/server";
import { fetchDiscover } from "@/lib/tmdb";
import { fetchForYouFilms } from "@/lib/recommendations";
import { getSession } from "@/lib/session";
import { parseProviders } from "@/lib/watch-providers";
import { parseDiscoverPage, parseDiscoverParams } from "@/lib/discover-params";

export async function GET(request: NextRequest) {
  const p = request.nextUrl.searchParams;
  // Filtres hors de ce que l'interface produit : refus net, sans appel TMDB.
  const { params, valid } = parseDiscoverParams((k) => p.get(k), "movie");
  const page = parseDiscoverPage(p.get("page"));
  if (!valid || page === null) {
    return NextResponse.json({ error: "Paramètres invalides" }, { status: 400 });
  }
  const { category, genre, minYear, maxYear, minRating, providers } = params;

  // Recommandations personnelles : hors session, il n'y a rien à recommander.
  if (category === "for_you") {
    const session = await getSession();
    if (!session) return NextResponse.json([]);
    return NextResponse.json(await fetchForYouFilms(session.userId, page));
  }

  const films = await fetchDiscover(category, {
    genreId: genre ? Number(genre) : null,
    page,
    minYear: minYear || undefined,
    maxYear: maxYear || undefined,
    minRating: minRating ? Number(minRating) : undefined,
    providers: parseProviders(providers),
  });
  return NextResponse.json(films);
}
