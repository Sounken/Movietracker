import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/**
 * Autocomplétion du Moviedle, **contrainte au vivier**.
 *
 * Volontairement distincte de `/api/search`, qui interroge TMDB : proposer un
 * titre absent du vivier n'apprendrait rien au joueur — il ne peut pas être
 * la réponse — et remplirait sa grille de lignes inutiles.
 */
export const dynamic = "force-dynamic";

const LIMIT = 8;

// Ouverte sans compte : le Moviedle se joue en visiteur. La requête ne lit
// que le vivier (titre, année, affiche), rien qui touche à un utilisateur.
export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const media = params.get("media") === "tv" ? "tv" : "movie";
  const q = (params.get("q") ?? "").trim();
  if (q.length < 1) return NextResponse.json({ results: [] });

  const query = (title: { startsWith: string } | { contains: string }) =>
    prisma.puzzleEntry.findMany({
      where: { media, title: { ...title, mode: "insensitive" } },
      // Les plus connus d'abord : sur « star », on veut Star Wars avant un
      // téléfilm homonyme.
      orderBy: { voteCount: "desc" },
      take: LIMIT,
      select: { tmdbId: true, title: true, year: true, posterUrl: true },
    });

  // Dès une seule lettre, « contient » ramène presque tout le vivier : sans
  // passer d'abord les titres qui commencent par la saisie, « a » proposerait
  // Gladiator avant Avatar, ce que le joueur ne cherche pas.
  const [prefix, inner] = await Promise.all([query({ startsWith: q }), query({ contains: q })]);

  const seen = new Set<number>();
  const results = [...prefix, ...inner]
    .filter((row) => !seen.has(row.tmdbId) && seen.add(row.tmdbId))
    .slice(0, LIMIT);

  return NextResponse.json({ results });
}
