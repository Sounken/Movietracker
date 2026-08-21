import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/db";
import { getFilmCards } from "@/lib/films";
import { getSeriesCards } from "@/lib/series";

export type Period = "week" | "month" | "year";

export const PERIODS: Period[] = ["week", "month", "year"];

export function parsePeriod(value: string | undefined): Period {
  return PERIODS.includes(value as Period) ? (value as Period) : "month";
}

export type TitleRanking = {
  tmdbId: number;
  title: string;
  posterUrl: string;
  year: string;
  genres: string[];
  count: number;
  avgRating: number | null;
};

export type GenreStat = { genre: string; count: number; percent: number };
export type ActiveUser = { id: string; name: string; avatarUrl: string | null; count: number };
export type RecentReview = {
  id: string;
  tmdbId: number;
  title: string;
  posterUrl: string | null;
  year: string;
  rating: number | null;
  review: string;
  updatedAt: string;
  user: { id: string; name: string; avatarUrl: string | null };
};

export type TrendsStats = {
  totalUsers: number;
  totalWatched: number;
  totalRated: number;
  totalReviews: number;
  totalWatchlist: number;
  totalHours: number;
};

export type TrendsData = {
  stats: TrendsStats;
  topWatched: TitleRanking[];
  topLiked: TitleRanking[];
  topRated: TitleRanking[];
  topWatchlisted: TitleRanking[];
  genres: GenreStat[];
  recentReviews: RecentReview[];
  activeUsers: ActiveUser[];
};

function getPeriodStart(period: Period): Date {
  const now = new Date();
  if (period === "week") return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  if (period === "year") return new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
  return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000); // month (défaut)
}

type GroupRow = {
  tmdbId: number;
  _count: { tmdbId: number };
  _avg?: { rating: number | null };
};

type Card = { title: string; posterUrl: string; year: string; genres: string[] };

function buildRanking(rows: GroupRow[], cards: Map<number, Card>): TitleRanking[] {
  return rows
    .map((row): TitleRanking | null => {
      const info = cards.get(row.tmdbId);
      if (!info) return null;
      return {
        tmdbId: row.tmdbId,
        title: info.title,
        posterUrl: info.posterUrl,
        year: info.year,
        genres: info.genres,
        count: row._count?.tmdbId ?? 0,
        avgRating: row._avg?.rating ?? null,
      };
    })
    .filter((x): x is TitleRanking => x !== null);
}

/** Répartition des genres, pondérée par le nombre de spectateurs de chaque titre. */
function buildGenreStats(rows: GroupRow[], cards: Map<number, Card>): GenreStat[] {
  const counts: Record<string, number> = {};
  for (const row of rows) {
    const info = cards.get(row.tmdbId);
    for (const g of info?.genres ?? []) {
      counts[g] = (counts[g] ?? 0) + (row._count?.tmdbId ?? 0);
    }
  }
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([genre, count]) => ({
      genre,
      count,
      percent: total > 0 ? Math.round((count / total) * 100) : 0,
    }));
}

async function resolveActiveUsers(
  rows: Array<{ userId: string; _count: { userId: number } }>,
): Promise<ActiveUser[]> {
  if (rows.length === 0) return [];
  const infos = await prisma.user.findMany({
    where: { id: { in: rows.map((u) => u.userId) } },
    select: { id: true, name: true, email: true, avatarUrl: true },
  });
  const byId = new Map(infos.map((u) => [u.id, u]));
  return rows
    .map((u): ActiveUser | null => {
      const info = byId.get(u.userId);
      if (!info) return null;
      return {
        id: u.userId,
        name: info.name ?? info.email.split("@")[0],
        avatarUrl: info.avatarUrl,
        count: u._count?.userId ?? 0,
      };
    })
    .filter((x): x is ActiveUser => x !== null);
}

// ——————————————————————————————————————————————————————————————
//  Films
// ——————————————————————————————————————————————————————————————

// Données communautaires (identiques pour tous) : le calcul est lourd, il est
// donc recalculé au plus une fois toutes les 10 min par période.
export const getFilmTrends = unstable_cache(
  async (period: Period): Promise<TrendsData> => {
    const dateFilter = { updatedAt: { gte: getPeriodStart(period) } };

    const [
      totalUsers, totalWatched, totalRated, totalReviews, totalWatchlist, runtimeAgg,
      topWatchedRaw, topLikedRaw, topRatedRaw, topWatchlistedRaw,
      recentReviewsRaw, activeUsersRaw,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.userFilm.count({ where: { watched: true, ...dateFilter } }),
      prisma.userFilm.count({ where: { rating: { not: null }, ...dateFilter } }),
      prisma.userFilm.count({ where: { review: { not: null }, ...dateFilter } }),
      prisma.userFilm.count({ where: { watchlist: true, ...dateFilter } }),
      prisma.userFilm.aggregate({ _sum: { runtime: true }, where: { watched: true, ...dateFilter } }),

      prisma.userFilm.groupBy({
        by: ["tmdbId"], where: { watched: true, ...dateFilter },
        _count: { tmdbId: true }, orderBy: { _count: { tmdbId: "desc" } }, take: 10,
      }),
      prisma.userFilm.groupBy({
        by: ["tmdbId"], where: { liked: true, ...dateFilter },
        _count: { tmdbId: true }, orderBy: { _count: { tmdbId: "desc" } }, take: 10,
      }),
      prisma.userFilm.groupBy({
        by: ["tmdbId"], where: { rating: { not: null }, ...dateFilter },
        _count: { tmdbId: true }, _avg: { rating: true },
        orderBy: { _avg: { rating: "desc" } }, take: 10,
      }),
      prisma.userFilm.groupBy({
        by: ["tmdbId"], where: { watchlist: true, ...dateFilter },
        _count: { tmdbId: true }, orderBy: { _count: { tmdbId: "desc" } }, take: 10,
      }),

      prisma.userFilm.findMany({
        where: { review: { not: null }, ...dateFilter },
        include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } },
        orderBy: { updatedAt: "desc" }, take: 10,
      }),
      prisma.userFilm.groupBy({
        by: ["userId"],
        where: { OR: [{ watched: true }, { liked: true }, { rating: { not: null } }], ...dateFilter },
        _count: { userId: true }, orderBy: { _count: { userId: "desc" } }, take: 8,
      }),
    ]);

    const ids = [...new Set([
      ...topWatchedRaw, ...topLikedRaw, ...topRatedRaw, ...topWatchlistedRaw,
    ].map((f) => f.tmdbId).concat(recentReviewsRaw.map((f) => f.tmdbId)))];

    const cards = await getFilmCards(ids);

    return {
      stats: {
        totalUsers, totalWatched, totalRated, totalReviews, totalWatchlist,
        totalHours: Math.round((runtimeAgg._sum.runtime ?? 0) / 60),
      },
      topWatched: buildRanking(topWatchedRaw, cards),
      topLiked: buildRanking(topLikedRaw, cards),
      topRated: buildRanking(topRatedRaw, cards),
      topWatchlisted: buildRanking(topWatchlistedRaw, cards),
      genres: buildGenreStats(topWatchedRaw, cards),
      recentReviews: recentReviewsRaw.map((item) => {
        const info = cards.get(item.tmdbId);
        return {
          id: item.id,
          tmdbId: item.tmdbId,
          title: info?.title ?? "Film inconnu",
          posterUrl: info?.posterUrl ?? null,
          year: info?.year ?? "",
          rating: item.rating,
          review: item.review!,
          updatedAt: item.updatedAt.toISOString(),
          user: {
            id: item.user.id,
            name: item.user.name ?? item.user.email.split("@")[0],
            avatarUrl: item.user.avatarUrl,
          },
        };
      }),
      activeUsers: await resolveActiveUsers(activeUsersRaw),
    };
  },
  ["trends-data"],
  { revalidate: 600, tags: ["trends"] },
);

// ——————————————————————————————————————————————————————————————
//  Séries
// ——————————————————————————————————————————————————————————————

export const getSeriesTrends = unstable_cache(
  async (period: Period): Promise<TrendsData> => {
    const start = getPeriodStart(period);
    const dateFilter = { updatedAt: { gte: start } };

    const [
      totalUsers, totalWatched, totalRated, totalReviews, totalWatchlist, episodeAgg,
      topWatchedRaw, topLikedRaw, topRatedRaw, topWatchlistedRaw,
      recentReviewsRaw, activeUsersRaw,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.userSeries.count({ where: { watched: true, ...dateFilter } }),
      prisma.userSeries.count({ where: { rating: { not: null }, ...dateFilter } }),
      prisma.userSeries.count({ where: { review: { not: null }, ...dateFilter } }),
      prisma.userSeries.count({ where: { watchlist: true, ...dateFilter } }),
      // Le temps de visionnage d'une série se compte en épisodes vus : UserSeries
      // n'a pas de champ `runtime`, contrairement à UserFilm.
      prisma.userEpisode.aggregate({
        _sum: { runtime: true },
        where: { watchedAt: { gte: start } },
      }),

      prisma.userSeries.groupBy({
        by: ["tmdbId"], where: { watched: true, ...dateFilter },
        _count: { tmdbId: true }, orderBy: { _count: { tmdbId: "desc" } }, take: 10,
      }),
      prisma.userSeries.groupBy({
        by: ["tmdbId"], where: { liked: true, ...dateFilter },
        _count: { tmdbId: true }, orderBy: { _count: { tmdbId: "desc" } }, take: 10,
      }),
      prisma.userSeries.groupBy({
        by: ["tmdbId"], where: { rating: { not: null }, ...dateFilter },
        _count: { tmdbId: true }, _avg: { rating: true },
        orderBy: { _avg: { rating: "desc" } }, take: 10,
      }),
      prisma.userSeries.groupBy({
        by: ["tmdbId"], where: { watchlist: true, ...dateFilter },
        _count: { tmdbId: true }, orderBy: { _count: { tmdbId: "desc" } }, take: 10,
      }),

      prisma.userSeries.findMany({
        where: { review: { not: null }, ...dateFilter },
        include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } },
        orderBy: { updatedAt: "desc" }, take: 10,
      }),
      prisma.userSeries.groupBy({
        by: ["userId"],
        where: { OR: [{ watched: true }, { liked: true }, { rating: { not: null } }], ...dateFilter },
        _count: { userId: true }, orderBy: { _count: { userId: "desc" } }, take: 8,
      }),
    ]);

    const ids = [...new Set([
      ...topWatchedRaw, ...topLikedRaw, ...topRatedRaw, ...topWatchlistedRaw,
    ].map((s) => s.tmdbId).concat(recentReviewsRaw.map((s) => s.tmdbId)))];

    // getSeriesCards renvoie `name` ; on l'aligne sur la forme commune `title`.
    const rawCards = await getSeriesCards(ids);
    const cards = new Map<number, Card>(
      [...rawCards.entries()].map(([id, c]) => [
        id,
        { title: c.name, posterUrl: c.posterUrl, year: c.year, genres: c.genres },
      ]),
    );

    return {
      stats: {
        totalUsers, totalWatched, totalRated, totalReviews, totalWatchlist,
        totalHours: Math.round((episodeAgg._sum.runtime ?? 0) / 60),
      },
      topWatched: buildRanking(topWatchedRaw, cards),
      topLiked: buildRanking(topLikedRaw, cards),
      topRated: buildRanking(topRatedRaw, cards),
      topWatchlisted: buildRanking(topWatchlistedRaw, cards),
      genres: buildGenreStats(topWatchedRaw, cards),
      recentReviews: recentReviewsRaw.map((item) => {
        const info = cards.get(item.tmdbId);
        return {
          id: item.id,
          tmdbId: item.tmdbId,
          title: info?.title ?? "Série inconnue",
          posterUrl: info?.posterUrl ?? null,
          year: info?.year ?? "",
          rating: item.rating,
          review: item.review!,
          updatedAt: item.updatedAt.toISOString(),
          user: {
            id: item.user.id,
            name: item.user.name ?? item.user.email.split("@")[0],
            avatarUrl: item.user.avatarUrl,
          },
        };
      }),
      activeUsers: await resolveActiveUsers(activeUsersRaw),
    };
  },
  ["series-trends-data"],
  { revalidate: 600, tags: ["trends"] },
);
