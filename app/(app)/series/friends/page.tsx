import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import { computeXP, getLevelInfo } from "@/lib/xp";
import Topbar from "../../components/Topbar";
import { getFeed } from "@/lib/activity";
import ActivityFeed from "../../friends/ActivityFeed";
import FriendsClient from "../../friends/FriendsClient";
import { getGreeting } from "@/lib/greeting";

// Champs nécessaires au calcul du niveau (cf. computeXP).
const XP_SELECT = { rating: true, review: true, liked: true, watched: true } as const;

export default async function SeriesFriendsPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const greeting = getGreeting();

  const followingRaw = await prisma.userFollow.findMany({
    where: { followerId: session.userId },
    include: {
      following: {
        select: {
          id: true, name: true, email: true, avatarUrl: true,
          _count: { select: { series: true } },
          series: { select: XP_SELECT },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const followersRaw = await prisma.userFollow.findMany({
    where: { followingId: session.userId },
    include: {
      follower: {
        select: {
          id: true, name: true, email: true, avatarUrl: true,
          series: { select: XP_SELECT },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const followingIds = new Set(followingRaw.map((f) => f.followingId));

  const feed = await getFeed(session.userId, "tv");

  const following = followingRaw.map((f) => {
    const ratings = f.following.series.map((s) => s.rating).filter(Boolean) as number[];
    const avg = ratings.length > 0 ? ratings.reduce((a, b) => a + b, 0) / ratings.length : null;
    const level = getLevelInfo(computeXP(f.following.series));
    return {
      id: f.following.id,
      name: f.following.name ?? f.following.email.split("@")[0],
      avatarUrl: f.following.avatarUrl,
      filmCount: f.following._count.series,
      avgRating: avg,
      level: level.level,
      levelTitle: level.title,
    };
  });

  const followers = followersRaw.map((f) => {
    const level = getLevelInfo(computeXP(f.follower.series));
    return {
      id: f.follower.id,
      name: f.follower.name ?? f.follower.email.split("@")[0],
      avatarUrl: f.follower.avatarUrl,
      followsBack: followingIds.has(f.follower.id),
      level: level.level,
      levelTitle: level.title,
    };
  });

  return (
    <div>
      <Topbar greeting={greeting} userName={session.name} />
      <FriendsClient
        following={following}
        followers={followers}
        feed={
          <ActivityFeed
            initialItems={feed.items}
            initialHasMore={feed.hasMore}
            media="tv"
            mediaBase="/series"
            profileBase="/series/user"
          />
        }
        countNoun="série"
        compareBase="/series/compare"
        profileBase="/series/user"
      />
    </div>
  );
}
