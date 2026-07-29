import { redirect } from "next/navigation";
import { Tv, Star, Clapperboard, Heart } from "lucide-react";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import { getSeriesCards } from "@/lib/series";
import { computeXP, getLevelInfo } from "@/lib/xp";
import Topbar from "../../components/Topbar";
import SeriesCollectionClient from "../../components/SeriesCollectionClient";
import discover from "../../films/discover/discover.module.css";
import styles from "../../films/profile/profile.module.css";

export default async function SeriesProfilePage() {
  const session = await getSession();
  if (!session) redirect("/login");
  const userId = session.userId;

  const [allSeries, watchedCount, ratedCount, likedCount, episodeAgg, ratedEntries, ratedTotal] =
    await Promise.all([
      prisma.userSeries.findMany({
        where: { userId },
        select: { rating: true, review: true, liked: true, watched: true },
      }),
      prisma.userSeries.count({ where: { userId, watched: true } }),
      prisma.userSeries.count({ where: { userId, rating: { not: null } } }),
      prisma.userSeries.count({ where: { userId, liked: true } }),
      prisma.userEpisode.aggregate({
        where: { userId },
        _count: { _all: true },
        _sum: { runtime: true },
      }),
      prisma.userSeries.findMany({
        where: { userId, rating: { not: null } },
        orderBy: { updatedAt: "desc" },
        take: 24,
        select: { tmdbId: true, rating: true },
      }),
      prisma.userSeries.count({ where: { userId, rating: { not: null } } }),
    ]);

  const levelInfo = getLevelInfo(computeXP(allSeries));
  const episodesWatched = episodeAgg._count._all;
  const hours = Math.floor((episodeAgg._sum.runtime ?? 0) / 60);
  const avgRating =
    ratedCount > 0
      ? allSeries.filter((s) => s.rating !== null).reduce((sum, s) => sum + (s.rating ?? 0), 0) / ratedCount
      : null;

  const cards = await getSeriesCards(ratedEntries.map((e) => e.tmdbId));
  const items = ratedEntries
    .map((e) => {
      const c = cards.get(e.tmdbId);
      return c
        ? { id: c.id, name: c.name, posterUrl: c.posterUrl, year: c.year, voteAverage: c.voteAverage, rating: e.rating }
        : null;
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Bonjour" : hour < 18 ? "Bon après-midi" : "Bonsoir";

  return (
    <div className={discover.page}>
      <Topbar greeting={greeting} userName={session.name ?? null} />

      <div className={discover.header}>
        <div className={discover.sectionSub}>
          Profil séries · {levelInfo.title} · niv. {levelInfo.level}
        </div>
        <h2 className={discover.sectionTitle}>Mes séries</h2>
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
            <div className={styles.statVal}>{avgRating !== null ? avgRating.toFixed(1) : "—"}</div>
            <div className={styles.statSub}>sur {ratedCount} notées</div>
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
          </div>
        </div>
      </div>

      <div className={styles.content}>
        <div className={styles.section}>
          <div className={styles.sectionHead}>
            <h2 className={styles.sectionTitle}>Ma collection</h2>
          </div>
          <SeriesCollectionClient
            initialItems={items}
            total={ratedTotal}
            type="rated"
            showWatchlist
            emptyTitle="Vous n'avez encore noté aucune série."
          />
        </div>
      </div>
    </div>
  );
}
