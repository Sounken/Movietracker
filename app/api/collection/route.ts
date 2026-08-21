import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import { getFilmCards } from "@/lib/films";

const PAGE_SIZE = 24;

// Types consultables sur le profil public d'un autre utilisateur.
// (la watchlist et « all » restent privés : réservés à son propre compte)
const PUBLIC_TYPES = new Set(["rated", "watched", "liked"]);

// Fragments SQL en liste blanche — jamais construits depuis l'entrée utilisateur.
const TYPE_SQL: Record<string, string> = {
  watched: 'uf."watched" = true',
  liked: 'uf."liked" = true',
  watchlist: 'uf."watchlist" = true',
  rated: 'uf."rating" IS NOT NULL',
  all: "TRUE",
};

// Colonne de note : la note perso, ou celle de TMDB (watchlist, films non notés)
function ratingColumn(field: string | null) {
  return field === "voteAverage" ? 'f."voteAverage"' : 'uf."rating"';
}

// `dir` vient d'une liste blanche côté appelant, mais on le re-valide ici :
// il est concaténé dans le SQL, jamais paramétrable.
function orderSql(sort: string, ratingCol: string, dir: string) {
  const d = dir === "asc" ? "ASC" : "DESC";
  // NULLS LAST dans les deux sens : un film sans note ne doit jamais remonter
  // en tête, même en tri croissant.
  if (sort === "rating") return `${ratingCol} ${d} NULLS LAST, uf."updatedAt" DESC`;
  // year est stocké en texte sur 4 caractères : le tri lexicographique est correct
  if (sort === "year") return `f."year" ${d} NULLS LAST, uf."updatedAt" DESC`;
  return `uf."updatedAt" ${d}`;
}

// Échappe les jokers LIKE pour qu'une recherche « 100% » ne matche pas tout.
function escapeLike(s: string) {
  return s.replace(/[\\%_]/g, (c) => `\\${c}`);
}

export async function GET(req: NextRequest) {
  const session = await getSession();

  const { searchParams } = req.nextUrl;
  const type = searchParams.get("type") ?? "watched";
  const sort = searchParams.get("sort") ?? "recent";
  const dir = searchParams.get("dir") === "asc" ? "asc" : "desc";
  const q = (searchParams.get("q") ?? "").trim();
  const skip = Math.max(parseInt(searchParams.get("skip") ?? "0"), 0);
  const take = Math.min(parseInt(searchParams.get("take") ?? String(PAGE_SIZE)), 60);
  const requestedUserId = searchParams.get("userId");

  const minRating = searchParams.get("minRating");
  const maxRating = searchParams.get("maxRating");
  const year = searchParams.get("year");

  // Sans userId explicite → sa propre collection (comportement historique)
  const targetUserId = requestedUserId ?? session?.userId;
  if (!targetUserId) {
    return NextResponse.json({ films: [], total: 0, years: [] }, { status: 401 });
  }

  // Collection d'un autre utilisateur : uniquement ce qui est déjà public sur son profil
  const isSelf = session?.userId === targetUserId;
  if (!isSelf && !PUBLIC_TYPES.has(type)) {
    return NextResponse.json({ films: [], total: 0, years: [] }, { status: 403 });
  }

  const typeSql = TYPE_SQL[type] ?? TYPE_SQL.watched;
  const ratingCol = ratingColumn(searchParams.get("ratingField"));
  const order = orderSql(sort, ratingCol, dir);

  // ——— Construction des filtres (valeurs toujours paramétrées) ———
  const params: unknown[] = [targetUserId];
  let where = `uf."userId" = $1 AND ${typeSql}`;

  if (minRating !== null && minRating !== "") {
    params.push(Number(minRating));
    where += ` AND ${ratingCol} >= $${params.length}`;
  }
  if (maxRating !== null && maxRating !== "") {
    params.push(Number(maxRating));
    where += ` AND ${ratingCol} <= $${params.length}`;
  }
  if (year) {
    params.push(year);
    where += ` AND f."year" = $${params.length}`;
  }
  if (q) {
    params.push(`%${escapeLike(q)}%`);
    where += ` AND f."title" ILIKE $${params.length} ESCAPE '\\'`;
  }

  const FROM = `FROM "UserFilm" uf LEFT JOIN "Film" f ON f."tmdbId" = uf."tmdbId"`;

  // Le tri et la pagination se font en base, sur TOUTE la collection.
  const pageParams = [...params, take, skip];
  const [rows, countRows, yearRows] = await Promise.all([
    prisma.$queryRawUnsafe<Array<{ tmdbId: number; rating: number | null }>>(
      `SELECT uf."tmdbId", uf."rating" ${FROM} WHERE ${where} ORDER BY ${order} LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      ...pageParams,
    ),
    prisma.$queryRawUnsafe<Array<{ count: number }>>(
      `SELECT COUNT(*)::int AS count ${FROM} WHERE ${where}`,
      ...params,
    ),
    // Années disponibles pour le menu déroulant (indépendant des filtres en cours)
    prisma.$queryRawUnsafe<Array<{ year: string }>>(
      `SELECT DISTINCT f."year" AS year ${FROM} WHERE uf."userId" = $1 AND ${typeSql} AND f."year" <> '' ORDER BY year DESC`,
      targetUserId,
    ),
  ]);

  const total = countRows[0]?.count ?? 0;
  const years = yearRows.map((r) => r.year).filter(Boolean);

  // Une seule requête pour toutes les fiches (au lieu d'une par film)
  const cards = await getFilmCards(rows.map((r) => r.tmdbId));

  const films = rows
    .map((row) => {
      const card = cards.get(row.tmdbId);
      return card ? { ...card, rating: row.rating ?? null } : null;
    })
    .filter(Boolean);

  return NextResponse.json({ films, total, years });
}
