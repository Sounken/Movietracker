import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import { getFilmCards } from "@/lib/films";

const PAGE_SIZE = 24;

// Types consultables sur le profil public d'un autre utilisateur.
// (la watchlist et « all » restent privés : réservés à son propre compte)
const PUBLIC_TYPES = new Set(["rated", "watched", "liked"]);

export async function GET(req: NextRequest) {
  const session = await getSession();

  const { searchParams } = req.nextUrl;
  const type = searchParams.get("type") ?? "watched";
  const skip = parseInt(searchParams.get("skip") ?? "0");
  const take = Math.min(parseInt(searchParams.get("take") ?? String(PAGE_SIZE)), 60);
  const requestedUserId = searchParams.get("userId");

  // Sans userId explicite → sa propre collection (comportement historique)
  const targetUserId = requestedUserId ?? session?.userId;
  if (!targetUserId) {
    return NextResponse.json({ films: [], total: 0 }, { status: 401 });
  }

  // Collection d'un autre utilisateur : uniquement ce qui est déjà public sur son profil
  const isSelf = session?.userId === targetUserId;
  if (!isSelf && !PUBLIC_TYPES.has(type)) {
    return NextResponse.json({ films: [], total: 0 }, { status: 403 });
  }

  const filterMap: Record<string, object> = {
    watched: { watched: true },
    liked: { liked: true },
    watchlist: { watchlist: true },
    rated: { rating: { not: null } },
    all: {},
  };
  const filter = filterMap[type] ?? { watched: true };

  const [total, entries] = await Promise.all([
    prisma.userFilm.count({ where: { userId: targetUserId, ...filter } }),
    prisma.userFilm.findMany({
      where: { userId: targetUserId, ...filter },
      orderBy: { updatedAt: "desc" },
      skip,
      take,
      select: { tmdbId: true, rating: true },
    }),
  ]);

  // Une seule requête pour toutes les fiches (au lieu d'une par film)
  const cards = await getFilmCards(entries.map((e) => e.tmdbId));

  const films = entries
    .map((entry) => {
      const card = cards.get(entry.tmdbId);
      return card ? { ...card, rating: entry.rating ?? null } : null;
    })
    .filter(Boolean);

  return NextResponse.json({ films, total });
}
