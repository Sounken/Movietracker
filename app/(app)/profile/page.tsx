import { notFound } from "next/navigation";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import { fetchFilmCard } from "@/lib/tmdb";
import Link from "next/link";
import ProfileEditor from "./ProfileEditor";
import FavoriteFilmsPicker from "./FavoriteFilmsPicker";
import CollectionClient from "../components/CollectionClient";
import AddFilmButton from "../components/AddFilmButton";
import { computeXP, getLevelInfo } from "@/lib/xp";
import styles from "./profile.module.css";

export default async function ProfilePage() {
  const session = await getSession();
  if (!session) notFound();

  const [user, stats, favoriteEntries, filmEntries] = await Promise.all([
    prisma.user.findUnique({ where: { id: session.userId } }),
    prisma.userFilm.aggregate({
      where: { userId: session.userId },
      _count: { id: true },
      _sum: { runtime: true },
    }),
    prisma.userFavoriteFilm.findMany({
      where: { userId: session.userId },
      orderBy: { position: "asc" },
    }),
    prisma.userFilm.findMany({
      where: {
        userId: session.userId,
        OR: [
          { rating: { not: null } },
          { watched: true },
          { watchlist: true },
          { liked: true },
        ],
      },
      orderBy: { updatedAt: "desc" },
    }),
  ]);

  if (!user) notFound();

  const levelInfo = getLevelInfo(computeXP(filmEntries));

  const [ratedCount, watchlistCount, likedCount] = await Promise.all([
    prisma.userFilm.count({ where: { userId: session.userId, rating: { not: null } } }),
    prisma.userFilm.count({ where: { userId: session.userId, watchlist: true } }),
    prisma.userFilm.count({ where: { userId: session.userId, liked: true } }),
  ]);

  const favoriteFilms = await Promise.all(
    [1, 2, 3].map(async (pos) => {
      const entry = favoriteEntries.find((e) => e.position === pos);
      if (!entry) return { position: pos, film: null };
      const film = await fetchFilmCard(entry.tmdbId);
      return { position: pos, film, tmdbId: entry.tmdbId };
    }),
  );

  const collectionFilms = (
    await Promise.all(
      filmEntries.map(async (entry) => {
        const card = await fetchFilmCard(entry.tmdbId);
        if (!card) return null;
        return { ...card, rating: entry.rating ?? null };
      }),
    )
  ).filter(Boolean) as Array<{ id: number; title: string; posterUrl: string; year: string; genres: string[]; rating: number | null }>;

  const totalHours = Math.floor((stats._sum.runtime ?? 0) / 60);
  const initial = (user.name ?? user.email)[0].toUpperCase();

  return (
    <div className={styles.page}>
      {/* ——— Banner ——— */}
      <div
        className={styles.banner}
        style={user.bannerUrl ? { backgroundImage: `url("${user.bannerUrl}")` } : undefined}
      />

      {/* ——— Header ——— */}
      <div className={styles.header}>
        <div className={styles.avatarWrap}>
          {user.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={user.avatarUrl} alt={user.name ?? ""} className={styles.avatar} />
          ) : (
            <div className={styles.avatarFallback}>{initial}</div>
          )}
        </div>

        <div className={styles.headerInfo}>
          <h1 className={styles.name}>{user.name ?? "Cinéphile"}</h1>
          <div className={styles.levelBadge}>
            <span className={styles.levelTitle}>{levelInfo.title}</span>
            <span className={styles.levelNum}>niv. {levelInfo.level}</span>
          </div>
          <div className={styles.xpRow}>
            <div className={styles.xpBarWrap} title={`${levelInfo.currentXP} / ${levelInfo.nextLevelXP} XP`}>
              <div className={styles.xpBar} style={{ width: `${levelInfo.percent}%` }} />
            </div>
            <span className={styles.xpLabel}>{levelInfo.currentXP} / {levelInfo.nextLevelXP} XP</span>
          </div>
          {user.bio && <p className={styles.bio}>{user.bio}</p>}
          <div className={styles.headerStats}>
            <div className={styles.headerStat}>
              <span className={styles.headerStatVal}>{ratedCount}</span>
              <span className={styles.headerStatLab}>Films notés</span>
            </div>
            <div className={styles.headerStat}>
              <span className={styles.headerStatVal}>{watchlistCount}</span>
              <span className={styles.headerStatLab}>À voir</span>
            </div>
            <div className={styles.headerStat}>
              <span className={styles.headerStatVal}>{likedCount}</span>
              <span className={styles.headerStatLab}>Favoris</span>
            </div>
            {totalHours > 0 && (
              <div className={styles.headerStat}>
                <span className={styles.headerStatVal}>{totalHours}h</span>
                <span className={styles.headerStatLab}>Visionnés</span>
              </div>
            )}
          </div>
        </div>

        <ProfileEditor
          name={user.name ?? ""}
          bio={user.bio ?? ""}
          avatarUrl={user.avatarUrl ?? ""}
          bannerUrl={user.bannerUrl ?? ""}
        />
      </div>

      {/* ——— Films favoris (top 3 Letterboxd style) ——— */}
      <div className={styles.section}>
        <div className={styles.sectionTitle}>Films préférés</div>
        <div className={styles.favGrid}>
          {favoriteFilms.map(({ position, film, tmdbId }) => (
            <div key={position} className={styles.favSlot}>
              {film ? (
                <Link href={`/film/${tmdbId}`} className={styles.favCard}>
                  <div
                    className={styles.favPoster}
                    style={{ backgroundImage: `url("${film.posterUrl}")` }}
                  />
                  <div className={styles.favInfo}>
                    <div className={styles.favTitle}>{film.title}</div>
                    {film.year && <div className={styles.favYear}>{film.year}</div>}
                  </div>
                </Link>
              ) : (
                <div className={styles.favEmpty}>
                  <span className={styles.favPos}>{position}</span>
                </div>
              )}
            </div>
          ))}
        </div>
        <FavoriteFilmsPicker
          slots={favoriteFilms.map(({ position, film, tmdbId }) => ({
            position: position as 1 | 2 | 3,
            tmdbId: tmdbId ?? null,
            title: film?.title ?? null,
          }))}
        />
      </div>

      {/* ——— Collection ——— */}
      <div className={styles.section}>
        <div className={styles.sectionHead}>
          <div className={styles.sectionTitle}>Ma collection</div>
          <AddFilmButton />
        </div>
        <CollectionClient films={collectionFilms} />
      </div>
    </div>
  );
}
