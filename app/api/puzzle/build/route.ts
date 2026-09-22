import { NextRequest, NextResponse } from "next/server";
import { buildPool, type PuzzleMedia } from "@/lib/puzzle-pool";

/**
 * Remplissage du vivier du Moviedle.
 *
 * Route plutôt que script : le projet n'embarque pas de lanceur TypeScript, et
 * une route se branche directement sur un cron côté hébergeur — c'est déjà ce
 * que prévoit G2-bis pour le rang des acteurs.
 *
 * Protégée par un jeton d'en-tête : elle écrit en base et déclenche des
 * milliers d'appels TMDB, ce n'est pas quelque chose qu'on laisse ouvert.
 * Sans `PUZZLE_BUILD_TOKEN` configuré, la route refuse tout — un secret absent
 * ne doit jamais valoir « pas de contrôle ».
 */
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const expected = process.env.PUZZLE_BUILD_TOKEN;
  if (!expected) {
    return NextResponse.json({ error: "PUZZLE_BUILD_TOKEN non configuré" }, { status: 503 });
  }
  if (req.headers.get("x-puzzle-token") !== expected) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const params = req.nextUrl.searchParams;
  const media = params.get("media") === "tv" ? "tv" : ("movie" as PuzzleMedia);
  const from = Math.max(1, Number(params.get("from") ?? 1) || 1);
  // Borne haute : au-delà, la requête dépasse le temps imparti à une fonction.
  const pages = Math.min(10, Math.max(1, Number(params.get("pages") ?? 5) || 5));

  const report = await buildPool(media, from, pages);
  return NextResponse.json(report);
}
