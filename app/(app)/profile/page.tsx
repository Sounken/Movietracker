import { notFound } from "next/navigation";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import { fetchFilmCard } from "@/lib/tmdb";
import ProfileHeaderClient from "./ProfileHeaderClient";
import FavFilmsClient from "./FavFilmsClient";
import CollectionClient from "../components/CollectionClient";
import AddFilmButton from "../components/AddFilmButton";
import { computeXP, getLevelInfo } from "@/lib/xp";
import styles from "./profile.module.css";

export default async function ProfilePage() {
  const session = await getSession();
  if (!session) notFound();

  const [user, filmEntries, favoriteEntries] = await Promise.all([
    prisma.user.findUnique({ where: { id: session.userId } }),
    prisma.userFilm.findMany({
      where: { userId: session.userId },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.userFavoriteFilm.findMany({
      where: { userId: session.userId },
      orderBy: { position: "asc" },
    }),
  ]);

  if (!user) notFound();

  const levelInfo = getLevelInfo(computeXP(filmEntries));

  const [watchedCount, ratedCount, watchlistCount, likedCount, runtimeAgg] = await Promise.all([
    prisma.userFilm.count({ where: { userId: session.userId, watched: true } }),
    prisma.userFilm.count({ where: { userId: session.userId, rating: { not: null } } }),
    prisma.userFilm.count({ where: { userId: session.userId, watchlist: true } }),
    prisma.userFilm.count({ where: { userId: session.userId, liked: true } }),
    prisma.userFilm.aggregate({
      where: { userId: session.userId, runtime: { not: null } },
      _sum: { runtime: true },
    }),
  ]);

  const totalHours = Math.floor((runtimeAgg._sum?.runtime ?? 0) / 60);

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const watchedThisMonth = filmEntries.filter((e) => e.watched && e.updatedAt >= startOfMonth).length;
  const hoursThisWeek =
    filmEntries
      .filter((e) => e.updatedAt >= sevenDaysAgo && e.runtime !== null)
      .reduce((sum, e) => sum + (e.runtime ?? 0), 0) / 60;

  const avgRating =
    ratedCount > 0
      ? filmEntries
          .filter((e) => e.rating !== null)
          .reduce((s, e) => s + (e.rating ?? 0), 0) / ratedCount
      : null;

  // 4 favorite films
  const favoriteFilms = await Promise.all(
    [1, 2, 3, 4].map(async (pos) => {
      const entry = favoriteEntries.find((e) => e.position === pos);
      if (!entry) return { position: pos, tmdbId: null, title: null, posterUrl: null, year: null };
      const film = await fetchFilmCard(entry.tmdbId);
      return {
        position: pos,
        tmdbId: entry.tmdbId,
        title: film?.title ?? null,
        posterUrl: film?.posterUrl ?? null,
        year: film?.year ?? null,
      };
    }),
  );

  // Collection (only films with meaningful data)
  const collectionFilms = (
    await Promise.all(
      filmEntries
        .filter((e) => e.rating !== null || e.watched || e.watchlist || e.liked)
        .map(async (entry) => {
          const card = await fetchFilmCard(entry.tmdbId);
          if (!card) return null;
          return { ...card, rating: entry.rating ?? null };
        }),
    )
  ).filter(Boolean) as Array<{ id: number; title: string; posterUrl: string; year: string; genres: string[]; rating: number | null }>;

  const initial = (user.name ?? user.email)[0].toUpperCase();
  const joinedYear = new Date(user.createdAt).getFullYear();

  return (
    <div className={styles.page}>
      {/* Banner + Header + XP — client component handles edit */}
      <ProfileHeaderClient
        name={user.name ?? ""}
        bio={user.bio ?? ""}
        avatarUrl={user.avatarUrl ?? ""}
        bannerUrl={user.bannerUrl ?? ""}
        initial={initial}
        levelInfo={levelInfo}
        joinedYear={joinedYear}
      />

      {/* Stats grid */}
      <div className={styles.statsSection}>
        <div className={styles.statsGrid}>
          <div className={styles.statCard}>
            <div className={styles.statDeco}>🎬</div>
            <div className={styles.statLabel}>Films vus</div>
            <div className={styles.statVal}>{watchedCount}</div>
            <div className={styles.statSub}>↑ +{watchedThisMonth} ce mois</div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statDeco}>⭐</div>
            <div className={styles.statLabel}>Note moyenne</div>
            <div className={styles.statVal}>{avgRating !== null ? avgRating.toFixed(1) : "—"}</div>
            <div className={styles.statSub}>sur {ratedCount} films notés</div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statDeco}>⏱</div>
            <div className={styles.statLabel}>Heures visionnées</div>
            <div className={styles.statVal}>{totalHours}<span style={{ fontSize: 20 }}>h</span></div>
            <div className={styles.statSub}>↑ +{hoursThisWeek.toFixed(1)}h cette semaine</div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statDeco}>❤️</div>
            <div className={styles.statLabel}>Favoris</div>
            <div className={styles.statVal}>{likedCount}</div>
            <div className={styles.statSub}>films aimés</div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statDeco}>📋</div>
            <div className={styles.statLabel}>À voir</div>
            <div className={styles.statVal}>{watchlistCount}</div>
            <div className={styles.statSub}>dans la watchlist</div>
          </div>
        </div>
      </div>

      <div className={styles.content}>
        {/* Favorite films */}
        <div className={styles.section}>
          <div className={styles.sectionHead}>
            <h2 className={styles.sectionTitle}>Films préférés</h2>
          </div>
          <FavFilmsClient
            slots={favoriteFilms.map((f) => ({ ...f, position: f.position as 1 | 2 | 3 | 4 }))}
          />
        </div>

        {/* Collection */}
        <div className={styles.section}>
          <div className={styles.sectionHead}>
            <h2 className={styles.sectionTitle}>Ma collection</h2>
            <AddFilmButton />
          </div>
          <CollectionClient films={collectionFilms} />
        </div>
      </div>
    </div>
  );
}
