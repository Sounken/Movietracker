import { notFound, redirect } from "next/navigation";
import { Tv, Star, Clapperboard, Heart, ClipboardList } from "lucide-react";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import { getSeriesCards } from "@/lib/series";
import { computeXP, getLevelInfo } from "@/lib/xp";
import { setFavoriteSeries } from "@/app/actions/series";
import ProfileHeaderClient from "../../films/profile/ProfileHeaderClient";
import FavFilmsClient from "../../films/profile/FavFilmsClient";
import SeriesCollectionClient from "../../components/SeriesCollectionClient";
import styles from "../../films/profile/profile.module.css";
import { Rating } from "@/lib/rating-scale";
import { toRatingScale } from "@/lib/rating";

export default async function SeriesProfilePage() {
  const session = await getSession();
  if (!session) redirect("/login");
  const userId = session.userId;

  const [user, allSeries] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId } }),
    prisma.userSeries.findMany({ where: { userId }, orderBy: { updatedAt: "desc" } }),
  ]);
  if (!user) notFound();

  const [watchedCount, ratedCount, watchlistCount, likedCount, episodeAgg, favoriteEntries] =
    await Promise.all([
      prisma.userSeries.count({ where: { userId, watched: true } }),
      prisma.userSeries.count({ where: { userId, rating: { not: null } } }),
      prisma.userSeries.count({ where: { userId, watchlist: true } }),
      prisma.userSeries.count({ where: { userId, liked: true } }),
      prisma.userEpisode.aggregate({ where: { userId }, _count: { _all: true }, _sum: { runtime: true } }),
      prisma.userFavoriteSeries.findMany({ where: { userId }, orderBy: { position: "asc" } }),
    ]);

  const levelInfo = getLevelInfo(computeXP(allSeries));
  const episodesWatched = episodeAgg._count._all;
  const hours = Math.floor((episodeAgg._sum.runtime ?? 0) / 60);
  const avgRating =
    ratedCount > 0
      ? allSeries.filter((s) => s.rating !== null).reduce((sum, s) => sum + (s.rating ?? 0), 0) / ratedCount
      : null;

  // Séries préférées (4 emplacements)
  const favCards = await getSeriesCards(favoriteEntries.map((e) => e.tmdbId));
  const favoriteSlots = [1, 2, 3, 4].map((pos) => {
    const entry = favoriteEntries.find((e) => e.position === pos);
    if (!entry) return { position: pos as 1 | 2 | 3 | 4, tmdbId: null, title: null, posterUrl: null, year: null };
    const card = favCards.get(entry.tmdbId);
    return {
      position: pos as 1 | 2 | 3 | 4,
      tmdbId: entry.tmdbId,
      title: card?.name ?? null,
      posterUrl: card?.posterUrl ?? null,
      year: card?.year ?? null,
    };
  });

  // Collection notée (1re page)
  const ratedEntries = allSeries.filter((s) => s.rating !== null);
  const ratedSlice = ratedEntries.slice(0, 24);
  const collCards = await getSeriesCards(ratedSlice.map((e) => e.tmdbId));
  const collectionItems = ratedSlice
    .map((e) => {
      const c = collCards.get(e.tmdbId);
      return c
        ? { id: c.id, name: c.name, posterUrl: c.posterUrl, year: c.year, voteAverage: c.voteAverage, rating: e.rating }
        : null;
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  const initial = (user.name ?? user.email)[0].toUpperCase();
  const joinedYear = new Date(user.createdAt).getFullYear();

  return (
    <div className={styles.page}>
      {/* Bannière + en-tête + XP (identité partagée, niveau séries) */}
      <ProfileHeaderClient
        name={user.name ?? ""}
        bio={user.bio ?? ""}
        avatarUrl={user.avatarUrl ?? ""}
        bannerUrl={user.bannerUrl ?? ""}
        initial={initial}
        levelInfo={levelInfo}
        joinedYear={joinedYear}
        ratingScale={toRatingScale(user.ratingScale)}
      />

      {/* Stats séries */}
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
            <div className={styles.statSub}>{hours}h visionnées</div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statDeco}><Heart size={26} fill="currentColor" /></div>
            <div className={styles.statLabel}>Favoris</div>
            <div className={styles.statVal}>{likedCount}</div>
            <div className={styles.statSub}>séries aimées</div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statDeco}><ClipboardList size={26} /></div>
            <div className={styles.statLabel}>À voir</div>
            <div className={styles.statVal}>{watchlistCount}</div>
            <div className={styles.statSub}>dans la watchlist</div>
          </div>
        </div>
      </div>

      <div className={styles.content}>
        {/* Séries préférées */}
        <div className={styles.section}>
          <div className={styles.sectionHead}>
            <h2 className={styles.sectionTitle}>Séries préférées</h2>
          </div>
          <FavFilmsClient
            slots={favoriteSlots}
            save={setFavoriteSeries}
            searchType="tv"
            noun="série"
            nounF
          />
        </div>

        {/* Collection */}
        <div className={styles.section}>
          <div className={styles.sectionHead}>
            <h2 className={styles.sectionTitle}>Ma collection</h2>
          </div>
          <SeriesCollectionClient
            initialItems={collectionItems}
            total={ratedCount}
            type="rated"
            showWatchlist
            emptyTitle="Vous n'avez encore noté aucune série."
          />
        </div>
      </div>
    </div>
  );
}
