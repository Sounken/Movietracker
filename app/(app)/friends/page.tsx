import { notFound } from "next/navigation";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import { fetchFilmCard } from "@/lib/tmdb";
import Topbar from "../components/Topbar";
import FriendsClient from "./FriendsClient";
import styles from "../dashboard.module.css";

export default async function FriendsPage() {
  const session = await getSession();
  if (!session) notFound();

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Bonjour" : hour < 18 ? "Bon après-midi" : "Bonsoir";

  // Who the current user follows
  const followingRaw = await prisma.userFollow.findMany({
    where: { followerId: session.userId },
    include: {
      following: {
        select: {
          id: true, name: true, email: true, avatarUrl: true,
          _count: { select: { films: true } },
          films: {
            where: { rating: { not: null } },
            select: { rating: true },
          },
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
        select: { id: true, name: true, email: true, avatarUrl: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  // Ids the current user follows (for follower "follow back" badge)
  const followingIds = new Set(followingRaw.map((f) => f.followingId));

  // Recent activity from followed users (last 20 film updates)
  const recentActivity = await prisma.userFilm.findMany({
    where: {
      userId: { in: [...followingIds] },
      OR: [{ watched: true }, { rating: { not: null } }, { liked: true }],
    },
    include: {
      user: { select: { id: true, name: true, email: true, avatarUrl: true } },
    },
    orderBy: { updatedAt: "desc" },
    take: 20,
  });

  // Fetch TMDB titles for activity items
  const activityWithTitles = await Promise.all(
    recentActivity.map(async (item) => {
      const card = await fetchFilmCard(item.tmdbId);
      return {
        id: item.id,
        tmdbId: item.tmdbId,
        title: card?.title ?? "Film inconnu",
        posterUrl: card?.posterUrl ?? null,
        year: card?.year ?? "",
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
    })
  );

  const following = followingRaw.map((f) => {
    const ratings = f.following.films.map((film) => film.rating).filter(Boolean) as number[];
    const avg = ratings.length > 0 ? ratings.reduce((a, b) => a + b, 0) / ratings.length : null;
    return {
      id: f.following.id,
      name: f.following.name ?? f.following.email.split("@")[0],
      avatarUrl: f.following.avatarUrl,
      filmCount: f.following._count.films,
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
        activity={activityWithTitles}
        currentUserId={session.userId}
      />
    </div>
  );
}
