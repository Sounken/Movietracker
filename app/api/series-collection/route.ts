import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import { getSeriesCards } from "@/lib/series";

const PAGE_SIZE = 24;
const PUBLIC_TYPES = new Set(["rated", "watched", "liked"]);

const TYPE_SQL: Record<string, string> = {
  watched: 'us."watched" = true',
  liked: 'us."liked" = true',
  watchlist: 'us."watchlist" = true',
  rated: 'us."rating" IS NOT NULL',
  all: "TRUE",
};

function ratingColumn(field: string | null) {
  return field === "voteAverage" ? 's."voteAverage"' : 'us."rating"';
}
function orderSql(sort: string, ratingCol: string) {
  if (sort === "rating") return `${ratingCol} DESC NULLS LAST, us."updatedAt" DESC`;
  if (sort === "year") return 's."year" DESC NULLS LAST, us."updatedAt" DESC';
  return 'us."updatedAt" DESC';
}

export async function GET(req: NextRequest) {
  const session = await getSession();
  const sp = req.nextUrl.searchParams;
  const type = sp.get("type") ?? "rated";
  const sort = sp.get("sort") ?? "recent";
  const skip = Math.max(parseInt(sp.get("skip") ?? "0"), 0);
  const take = Math.min(parseInt(sp.get("take") ?? String(PAGE_SIZE)), 60);
  const requestedUserId = sp.get("userId");
  const minRating = sp.get("minRating");
  const maxRating = sp.get("maxRating");
  const year = sp.get("year");

  const targetUserId = requestedUserId ?? session?.userId;
  if (!targetUserId) {
    return NextResponse.json({ films: [], total: 0, years: [] }, { status: 401 });
  }
  const isSelf = session?.userId === targetUserId;
  if (!isSelf && !PUBLIC_TYPES.has(type)) {
    return NextResponse.json({ films: [], total: 0, years: [] }, { status: 403 });
  }

  const typeSql = TYPE_SQL[type] ?? TYPE_SQL.rated;
  const ratingCol = ratingColumn(sp.get("ratingField"));
  const order = orderSql(sort, ratingCol);

  const params: unknown[] = [targetUserId];
  let where = `us."userId" = $1 AND ${typeSql}`;
  if (minRating) {
    params.push(Number(minRating));
    where += ` AND ${ratingCol} >= $${params.length}`;
  }
  if (maxRating) {
    params.push(Number(maxRating));
    where += ` AND ${ratingCol} <= $${params.length}`;
  }
  if (year) {
    params.push(year);
    where += ` AND s."year" = $${params.length}`;
  }

  const FROM = `FROM "UserSeries" us LEFT JOIN "Series" s ON s."tmdbId" = us."tmdbId"`;
  const pageParams = [...params, take, skip];

  const [rows, countRows, yearRows] = await Promise.all([
    prisma.$queryRawUnsafe<Array<{ tmdbId: number; rating: number | null }>>(
      `SELECT us."tmdbId", us."rating" ${FROM} WHERE ${where} ORDER BY ${order} LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      ...pageParams,
    ),
    prisma.$queryRawUnsafe<Array<{ count: number }>>(
      `SELECT COUNT(*)::int AS count ${FROM} WHERE ${where}`,
      ...params,
    ),
    prisma.$queryRawUnsafe<Array<{ year: string }>>(
      `SELECT DISTINCT s."year" AS year ${FROM} WHERE us."userId" = $1 AND ${typeSql} AND s."year" <> '' ORDER BY year DESC`,
      targetUserId,
    ),
  ]);

  const total = countRows[0]?.count ?? 0;
  const years = yearRows.map((r) => r.year).filter(Boolean);

  const cards = await getSeriesCards(rows.map((r) => r.tmdbId));
  const items = rows
    .map((row) => {
      const c = cards.get(row.tmdbId);
      return c
        ? { id: c.id, name: c.name, posterUrl: c.posterUrl, year: c.year, voteAverage: c.voteAverage, rating: row.rating }
        : null;
    })
    .filter(Boolean);

  return NextResponse.json({ items, total, years });
}
