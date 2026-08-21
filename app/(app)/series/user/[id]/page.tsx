import { notFound, redirect } from "next/navigation";
import Image from "next/image";
import { Tv, Star, Clapperboard, Heart, Sparkles } from "lucide-react";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import { getSeriesCards } from "@/lib/series";
import { computeXP, getLevelInfo } from "@/lib/xp";
import SeriesGrid, { type SeriesGridItem } from "../../../components/SeriesGrid";
import SeriesCollectionClient from "../../../components/SeriesCollectionClient";
import FollowButton from "../../../user/[id]/FollowButton";
import styles from "../../../films/profile/profile.module.css";
import { Rating } from "@/lib/rating-scale";

const COLLECTION_LIMIT = 24;

/**
 * Profil public d'un autre utilisateur, côté Séries.
 *
 * Jumeau de `/user/[id]` : même identité (bannière, avatar, bio, abonnement),
 * mais toutes les données viennent de UserSeries / UserEpisode. Depuis la
 * page Amis du monde Séries, cliquer sur quelqu'un menait auparavant à sa
 * collection de films, ce qui n'avait aucun rapport avec ce qu'on consultait.
 */
export default async function PublicSeriesProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [{ id }, session] = await Promise.all([params, getSession()]);

  // Son propre profil → la page éditable, dans le bon monde.
  if (session?.userId === id) redirect("/series/profile");

  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) notFound();

  const [
    seriesEntries,
    favoriteEntries,
    watchedCount,
    ratedCount,
    likedCount,
    episodeAgg,
    follow,
  ] = await Promise.all([
    prisma.userSeries.findMany({ where: { userId: id }, orderBy: { updatedAt: "desc" } }),
    prisma.userFavoriteSeries.findMany({ where: { userId: id }, orderBy: { position: "asc" } }),
    prisma.userSeries.count({ where: { userId: id, watched: true } }),
    prisma.userSeries.count({ where: { userId: id, rating: { not: null } } }),
    prisma.userSeries.count({ where: { userId: id, liked: true } }),
    // Le temps de visionnage d'une série se compte en épisodes vus : UserSeries
    // n'a pas de champ `runtime`, contrairement à UserFilm.
    prisma.userEpisode.aggregate({
      where: { userId: id },
      _count: { _all: true },
      _sum: { runtime: true },
    }),
    session
      ? prisma.userFollow.findUnique({
          where: { followerId_followingId: { followerId: session.userId, followingId: id } },
        })
      : Promise.resolve(null),
  ]);

  const levelInfo = getLevelInfo(computeXP(seriesEntries));
  const episodesWatched = episodeAgg._count._all;
  const hours = Math.floor((episodeAgg._sum.runtime ?? 0) / 60);
  const avgRating =
    ratedCount > 0
      ? seriesEntries.filter((s) => s.rating !== null).reduce((sum, s) => sum + (s.rating ?? 0), 0) /
        ratedCount
      : null;

  const ratedEntries = seriesEntries.filter((s) => s.rating !== null);
  const firstPage = ratedEntries.slice(0, COLLECTION_LIMIT);

  // Une seule requête pour la 1re page ET les séries préférées.
  const cards = await getSeriesCards([
    ...firstPage.map((e) => e.tmdbId),
    ...favoriteEntries.map((e) => e.tmdbId),
  ]);

  const collectionItems = firstPage
    .map((e) => {
      const c = cards.get(e.tmdbId);
      return c
        ? {
            id: c.id,
            name: c.name,
            posterUrl: c.posterUrl,
            year: c.year,
            voteAverage: c.voteAverage,
            rating: e.rating,
          }
        : null;
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  const favoriteSeries = favoriteEntries
    .map((e): SeriesGridItem | null => {
      const c = cards.get(e.tmdbId);
      return c
        ? { id: c.id, name: c.name, posterUrl: c.posterUrl, year: c.year, voteAverage: c.voteAverage }
        : null;
    })
    .filter((x): x is SeriesGridItem => x !== null);

  const displayName = user.name ?? user.email.split("@")[0];
  const initial = displayName[0]?.toUpperCase() ?? "?";
  const joinedYear = new Date(user.createdAt).getFullYear();

  return (
    <div className={styles.page}>
      <div
        className={styles.banner}
        style={user.bannerUrl ? { backgroundImage: `url("${user.bannerUrl}")` } : undefined}
      >
        <div className={styles.bannerGrain} />
        <div className={styles.bannerOverlay} />
      </div>

      {/* En-tête profil (lecture seule) */}
      <div className={styles.profileHeader}>
        <div className={styles.profileHeaderInner}>
          <div className={styles.avatarWrap}>
            {user.avatarUrl ? (
              <Image
                src={user.avatarUrl}
                alt={displayName}
                className={styles.avatar}
                width={120}
                height={120}
              />
            ) : (
              <div className={styles.avatarFallback}>{initial}</div>
            )}
            <div className={styles.levelCircle}>{levelInfo.level}</div>
          </div>

          <div className={styles.nameBlock}>
            <h1 className={styles.name}>{displayName}</h1>
            <div className={styles.metaRow}>
              <span className={styles.profileBadge}>
                <Sparkles size={11} /> {levelInfo.title}
              </span>
              <span className={styles.joinedDate}>Membre depuis {joinedYear}</span>
            </div>
            {user.bio && <p className={styles.bio}>{user.bio}</p>}
          </div>

          {session && (
            <div className={styles.profileActions}>
              <FollowButton targetId={id} initialFollowing={!!follow} />
            </div>
          )}
        </div>
      </div>

      {/* Progression (niveau séries) */}
      <div className={styles.xpSection}>
        <div className={styles.xpRow}>
          <span className={styles.xpLabel}>
            {levelInfo.title} · niveau {levelInfo.level}
          </span>
          <span className={styles.xpVal}>
            {levelInfo.currentXP} / {levelInfo.nextLevelXP} XP
          </span>
        </div>
        <div className={styles.xpBarBg}>
          <div className={styles.xpBarFill} style={{ width: `${levelInfo.percent}%` }} />
        </div>
      </div>

      <div className={styles.statsSection}>
        <div className={styles.statsGrid}>
          <div className={styles.statCard}>
            <div className={styles.statDeco}><Tv size={26} /></div>
            <div className={styles.statLabel}>Séries suivies</div>
            <div className={styles.statVal}>{watchedCount}</div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statDeco}><Star size={26} /></div>
            <div className={styles.statLabel}>Note moyenne</div>
            <div className={styles.statVal}><Rating value={avgRating} /></div>
            <div className={styles.statSub}>sur {ratedCount} séries notées</div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statDeco}><Clapperboard size={26} /></div>
            <div className={styles.statLabel}>Épisodes vus</div>
            <div className={styles.statVal}>{episodesWatched}</div>
            <div className={styles.statSub}>{hours}h de visionnage</div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statDeco}><Heart size={26} fill="currentColor" /></div>
            <div className={styles.statLabel}>Favoris</div>
            <div className={styles.statVal}>{likedCount}</div>
            <div className={styles.statSub}>séries aimées</div>
          </div>
        </div>
      </div>

      <div className={styles.content}>
        {favoriteSeries.length > 0 && (
          <div className={styles.section}>
            <div className={styles.sectionHead}>
              <h2 className={styles.sectionTitle}>Séries préférées</h2>
            </div>
            <SeriesGrid items={favoriteSeries} />
          </div>
        )}

        <div className={styles.section}>
          <div className={styles.sectionHead}>
            <h2 className={styles.sectionTitle}>Séries notées</h2>
          </div>
          <SeriesCollectionClient
            initialItems={collectionItems}
            total={ratedCount}
            type="rated"
            userId={id}
            emptyTitle={`${displayName} n'a encore noté aucune série.`}
          />
        </div>
      </div>
    </div>
  );
}
