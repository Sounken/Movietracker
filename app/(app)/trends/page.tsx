import { notFound } from "next/navigation";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import { fetchFilmCard } from "@/lib/tmdb";
import Topbar from "../components/Topbar";
import TrendsClient from "./TrendsClient";

export type Period = "week" | "month" | "year" | "all";

export type FilmRanking = {
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

function getPeriodStart(period: Period): Date | null {
  const now = new Date();
  if (period === "week") return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  if (period === "month") return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  if (period === "year") return new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
  return null;
}

export default async function TrendsPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const session = await getSession();
  if (!session) notFound();

  const { period: periodParam } = await searchParams;
  const period: Period = (["week", "month", "year", "all"] as const).includes(
    periodParam as Period
  )
    ? (periodParam as Period)
    : "month";

  const since = getPeriodStart(period);
  const dateFilter = since ? { updatedAt: { gte: since } } : {};

  const [
    totalUsers,
    totalWatched,
    totalRated,
    totalReviews,
    totalWatchlist,
    runtimeAgg,
    topWatchedRaw,
    topLikedRaw,
    topRatedRaw,
    topWatchlistedRaw,
    recentReviewsRaw,
    activeUsersRaw,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.userFilm.count({ where: { watched: true, ...dateFilter } }),
    prisma.userFilm.count({ where: { rating: { not: null }, ...dateFilter } }),
    prisma.userFilm.count({ where: { review: { not: null }, ...dateFilter } }),
    prisma.userFilm.count({ where: { watchlist: true, ...dateFilter } }),
    prisma.userFilm.aggregate({ _sum: { runtime: true }, where: { watched: true, ...dateFilter } }),

    prisma.userFilm.groupBy({
      by: ["tmdbId"],
      where: { watched: true, ...dateFilter },
      _count: { tmdbId: true },
      orderBy: { _count: { tmdbId: "desc" } },
      take: 10,
    }),
    prisma.userFilm.groupBy({
      by: ["tmdbId"],
      where: { liked: true, ...dateFilter },
      _count: { tmdbId: true },
      orderBy: { _count: { tmdbId: "desc" } },
      take: 10,
    }),
    prisma.userFilm.groupBy({
      by: ["tmdbId"],
      where: { rating: { not: null }, ...dateFilter },
      _count: { tmdbId: true },
      _avg: { rating: true },
      orderBy: { _avg: { rating: "desc" } },
      take: 10,
    }),
    prisma.userFilm.groupBy({
      by: ["tmdbId"],
      where: { watchlist: true, ...dateFilter },
      _count: { tmdbId: true },
      orderBy: { _count: { tmdbId: "desc" } },
      take: 10,
    }),

    prisma.userFilm.findMany({
      where: { review: { not: null }, ...dateFilter },
      include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } },
      orderBy: { updatedAt: "desc" },
      take: 10,
    }),

    prisma.userFilm.groupBy({
      by: ["userId"],
      where: { OR: [{ watched: true }, { liked: true }, { rating: { not: null } }], ...dateFilter },
      _count: { userId: true },
      orderBy: { _count: { userId: "desc" } },
      take: 8,
    }),
  ]);

  // Collect unique tmdbIds
  const allIds = [
    ...new Set([
      ...topWatchedRaw.map((f) => f.tmdbId),
      ...topLikedRaw.map((f) => f.tmdbId),
      ...topRatedRaw.map((f) => f.tmdbId),
      ...topWatchlistedRaw.map((f) => f.tmdbId),
      ...recentReviewsRaw.map((f) => f.tmdbId),
    ]),
  ];

  // Batch TMDB fetches (8 per batch, 150ms between)
  const tmdbMap = new Map<number, { title: string; posterUrl: string; year: string; genres: string[] }>();
  for (let i = 0; i < allIds.length; i += 8) {
    const batch = allIds.slice(i, i + 8);
    const results = await Promise.all(batch.map((id) => fetchFilmCard(id)));
    results.forEach((card, idx) => {
      if (card) tmdbMap.set(batch[idx], card);
    });
    if (i + 8 < allIds.length) await new Promise((r) => setTimeout(r, 150));
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function buildRanking(items: any[]): FilmRanking[] {
    return items
      .map((item) => {
        const info = tmdbMap.get(item.tmdbId as number);
        if (!info) return null;
        return {
          tmdbId: item.tmdbId as number,
          title: info.title,
          posterUrl: info.posterUrl,
          year: info.year,
          genres: info.genres,
          count: (item._count?.tmdbId ?? 0) as number,
          avgRating: (item._avg?.rating ?? null) as number | null,
        };
      })
      .filter(Boolean) as FilmRanking[];
  }

  // Genre distribution from top watched films
  const genreCounts: Record<string, number> = {};
  topWatchedRaw.forEach((item) => {
    const info = tmdbMap.get(item.tmdbId);
    info?.genres.forEach((g) => {
      genreCounts[g] = (genreCounts[g] ?? 0) + (item._count?.tmdbId ?? 0);
    });
  });
  const totalGenreCount = Object.values(genreCounts).reduce((a, b) => a + b, 0);
  const genres: GenreStat[] = Object.entries(genreCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([genre, count]) => ({
      genre,
      count,
      percent: totalGenreCount > 0 ? Math.round((count / totalGenreCount) * 100) : 0,
    }));

  // Active users with info
  const activeUserIds = activeUsersRaw.map((u) => u.userId);
  const activeUserInfos = await prisma.user.findMany({
    where: { id: { in: activeUserIds } },
    select: { id: true, name: true, email: true, avatarUrl: true },
  });
  const userInfoMap = new Map(activeUserInfos.map((u) => [u.id, u]));
  const activeUsers: ActiveUser[] = activeUsersRaw
    .map((u) => {
      const info = userInfoMap.get(u.userId);
      if (!info) return null;
      return {
        id: u.userId,
        name: info.name ?? info.email.split("@")[0],
        avatarUrl: info.avatarUrl,
        count: u._count?.userId ?? 0,
      };
    })
    .filter(Boolean) as ActiveUser[];

  const recentReviews: RecentReview[] = recentReviewsRaw.map((item) => {
    const info = tmdbMap.get(item.tmdbId);
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
  });

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Bonjour" : hour < 18 ? "Bon après-midi" : "Bonsoir";

  return (
    <div>
      <Topbar greeting={greeting} userName={session.name} />
      <TrendsClient
        period={period}
        stats={{
          totalUsers,
          totalWatched,
          totalRated,
          totalReviews,
          totalWatchlist,
          totalHours: Math.round((runtimeAgg._sum.runtime ?? 0) / 60),
        }}
        topWatched={buildRanking(topWatchedRaw)}
        topLiked={buildRanking(topLikedRaw)}
        topRated={buildRanking(topRatedRaw)}
        topWatchlisted={buildRanking(topWatchlistedRaw)}
        genres={genres}
        recentReviews={recentReviews}
        activeUsers={activeUsers}
      />
    </div>
  );
}
