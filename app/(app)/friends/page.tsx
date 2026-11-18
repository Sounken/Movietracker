import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import { computeXP, getLevelInfo } from "@/lib/xp";
import Topbar from "../components/Topbar";
import { getFeed } from "@/lib/activity";
import ActivityFeed from "./ActivityFeed";
import FriendsClient from "./FriendsClient";
import { getGreeting } from "@/lib/greeting";

// Les champs dont computeXP a besoin : la note seule ne suffit pas, un avis
// vaut plus qu'une note et un « j'aime » compte aussi.
const XP_SELECT = { rating: true, review: true, liked: true, watched: true } as const;

export default async function FriendsPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const greeting = getGreeting();

  // Who the current user follows
  const followingRaw = await prisma.userFollow.findMany({
    where: { followerId: session.userId },
    include: {
      following: {
        select: {
          id: true, name: true, email: true, avatarUrl: true,
          _count: { select: { films: true } },
          // Toute la collection : le niveau se calcule sur l'ensemble de
          // l'activité, pas seulement sur les films notés.
          films: { select: XP_SELECT },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  // Who follows the current user
  const followersRaw = await prisma.userFollow.findMany({
    where: { followingId: session.userId },
    include: {
      follower: {
        select: {
          id: true, name: true, email: true, avatarUrl: true,
          films: { select: XP_SELECT },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  // Ids the current user follows (for follower "follow back" badge)
  const followingIds = new Set(followingRaw.map((f) => f.followingId));

  const feed = await getFeed(session.userId, "movie");

  const following = followingRaw.map((f) => {
    const ratings = f.following.films.map((film) => film.rating).filter(Boolean) as number[];
    const avg = ratings.length > 0 ? ratings.reduce((a, b) => a + b, 0) / ratings.length : null;
    const level = getLevelInfo(computeXP(f.following.films));
    return {
      id: f.following.id,
      name: f.following.name ?? f.following.email.split("@")[0],
      avatarUrl: f.following.avatarUrl,
      filmCount: f.following._count.films,
      avgRating: avg,
      level: level.level,
      levelTitle: level.title,
    };
  });

  const followers = followersRaw.map((f) => {
    const level = getLevelInfo(computeXP(f.follower.films));
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
            media="movie"
            mediaBase="/film"
            profileBase="/user"
          />
        }
      />
    </div>
  );
}
