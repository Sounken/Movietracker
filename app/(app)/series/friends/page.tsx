import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import { getSeriesCards } from "@/lib/series";
import Topbar from "../../components/Topbar";
import FriendsClient from "../../friends/FriendsClient";

export default async function SeriesFriendsPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Bonjour" : hour < 18 ? "Bon après-midi" : "Bonsoir";

  const followingRaw = await prisma.userFollow.findMany({
    where: { followerId: session.userId },
    include: {
      following: {
        select: {
          id: true, name: true, email: true, avatarUrl: true,
          _count: { select: { series: true } },
          series: { where: { rating: { not: null } }, select: { rating: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const followersRaw = await prisma.userFollow.findMany({
    where: { followingId: session.userId },
    include: { follower: { select: { id: true, name: true, email: true, avatarUrl: true } } },
    orderBy: { createdAt: "desc" },
  });

  const followingIds = new Set(followingRaw.map((f) => f.followingId));

  const recentActivity = await prisma.userSeries.findMany({
    where: {
      userId: { in: [...followingIds] },
      OR: [{ watched: true }, { rating: { not: null } }, { liked: true }],
    },
    include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } },
    orderBy: { updatedAt: "desc" },
    take: 20,
  });

  const activityCards = await getSeriesCards(recentActivity.map((i) => i.tmdbId));
  const activity = recentActivity.map((item) => {
    const c = activityCards.get(item.tmdbId);
    return {
      id: item.id,
      tmdbId: item.tmdbId,
      title: c?.name ?? "Série inconnue",
      posterUrl: c?.posterUrl ?? null,
      year: c?.year ?? "",
      watched: item.watched,
      liked: item.liked,
      rating: item.rating,
      updatedAt: item.updatedAt.toISOString(),
      user: {
        id: item.user.id,
        name: item.user.name ?? item.user.email.split("@")[0],
        avatarUrl: item.user.avatarUrl,
      },
    };
  });

  const following = followingRaw.map((f) => {
    const ratings = f.following.series.map((s) => s.rating).filter(Boolean) as number[];
    const avg = ratings.length > 0 ? ratings.reduce((a, b) => a + b, 0) / ratings.length : null;
    return {
      id: f.following.id,
      name: f.following.name ?? f.following.email.split("@")[0],
      avatarUrl: f.following.avatarUrl,
      filmCount: f.following._count.series,
      avgRating: avg,
    };
  });

  const followers = followersRaw.map((f) => ({
    id: f.follower.id,
    name: f.follower.name ?? f.follower.email.split("@")[0],
    avatarUrl: f.follower.avatarUrl,
    followsBack: followingIds.has(f.follower.id),
  }));

  return (
    <div>
      <Topbar greeting={greeting} userName={session.name} />
      <FriendsClient
        following={following}
        followers={followers}
        activity={activity}
        mediaBase="/series"
        countNoun="série"
      />
    </div>
  );
}
