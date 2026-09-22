import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/db";

/**
 * Autocomplétion du Moviedle, **contrainte au vivier**.
 *
 * Volontairement distincte de `/api/search`, qui interroge TMDB : proposer un
 * titre absent du vivier n'apprendrait rien au joueur — il ne peut pas être
 * la réponse — et remplirait sa grille de lignes inutiles.
 */
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ results: [] }, { status: 401 });

  const params = req.nextUrl.searchParams;
  const media = params.get("media") === "tv" ? "tv" : "movie";
  const q = (params.get("q") ?? "").trim();
  if (q.length < 2) return NextResponse.json({ results: [] });

  const rows = await prisma.puzzleEntry.findMany({
    where: { media, title: { contains: q, mode: "insensitive" } },
    // Les plus connus d'abord : sur « star », on veut Star Wars avant un
    // téléfilm homonyme.
    orderBy: { voteCount: "desc" },
    take: 8,
    select: { tmdbId: true, title: true, year: true, posterUrl: true },
  });

  return NextResponse.json({ results: rows });
}
