import { notFound, redirect } from "next/navigation";
import Image from "next/image";
import { Clapperboard, Star, Clock, Heart, Sparkles } from "lucide-react";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import { type TmdbFilmCard } from "@/lib/tmdb";
import { getFilmCards } from "@/lib/films";
import FilmGrid from "../../components/FilmGrid";
import CollectionClient from "../../components/CollectionClient";
import FollowButton from "./FollowButton";
import { computeXP, getLevelInfo } from "@/lib/xp";
import styles from "../../films/profile/profile.module.css";
import { Rating } from "@/lib/rating-scale";

const COLLECTION_LIMIT = 24;

export default async function PublicProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [{ id }, session] = await Promise.all([params, getSession()]);

  // Son propre profil → on renvoie vers la page profil éditable
  if (session?.userId === id) redirect("/films/profile");

  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) notFound();

  const [filmEntries, favoriteEntries, watchedCount, ratedCount, likedCount, runtimeAgg, follow] =
    await Promise.all([
      prisma.userFilm.findMany({ where: { userId: id }, orderBy: { updatedAt: "desc" } }),
      prisma.userFavoriteFilm.findMany({ where: { userId: id }, orderBy: { position: "asc" } }),
      prisma.userFilm.count({ where: { userId: id, watched: true } }),
      prisma.userFilm.count({ where: { userId: id, rating: { not: null } } }),
      prisma.userFilm.count({ where: { userId: id, liked: true } }),
      prisma.userFilm.aggregate({
        where: { userId: id, runtime: { not: null } },
        _sum: { runtime: true },
      }),
      session
        ? prisma.userFollow.findUnique({
            where: {
              followerId_followingId: { followerId: session.userId, followingId: id },
            },
          })
        : Promise.resolve(null),
    ]);

  const levelInfo = getLevelInfo(computeXP(filmEntries));
  const totalHours = Math.floor((runtimeAgg._sum?.runtime ?? 0) / 60);
  const avgRating =
    ratedCount > 0
      ? filmEntries.filter((e) => e.rating !== null).reduce((s, e) => s + (e.rating ?? 0), 0) /
        ratedCount
      : null;

  // Films notés (les plus récents d'abord) — 1re page, la suite se charge à la demande
  const ratedEntries = filmEntries.filter((e) => e.rating !== null);
  const firstPage = ratedEntries.slice(0, COLLECTION_LIMIT);

  // Une seule requête base pour toutes les fiches (1re page + films préférés)
  const cards = await getFilmCards([
    ...firstPage.map((e) => e.tmdbId),
    ...favoriteEntries.map((e) => e.tmdbId),
  ]);

  const ratedFilms = firstPage
    .map((entry) => {
      const card = cards.get(entry.tmdbId);
      return card ? { ...card, rating: entry.rating } : null;
    })
    .filter(Boolean) as Array<TmdbFilmCard & { rating: number | null }>;

  const favoriteFilms = favoriteEntries
    .map((entry) => {
      const card = cards.get(entry.tmdbId);
      return card ? { ...card, rating: null } : null;
    })
    .filter(Boolean) as Array<TmdbFilmCard & { rating: number | null }>;

  const displayName = user.name ?? user.email.split("@")[0];
  const initial = displayName[0]?.toUpperCase() ?? "?";
  const joinedYear = new Date(user.createdAt).getFullYear();

  return (
    <div className={styles.page}>
      {/* Bannière */}
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
              <Image src={user.avatarUrl} alt={displayName} className={styles.avatar} width={120} height={120} />
            ) : (
              <div className={styles.avatarFallback}>{initial}</div>
            )}
            <div className={styles.levelCircle}>{levelInfo.level}</div>
          </div>

          <div className={styles.nameBlock}>
            <h1 className={styles.name}>{displayName}</h1>
            <div className={styles.metaRow}>
              <span className={styles.profileBadge}><Sparkles size={11} /> {levelInfo.title}</span>
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

      {/* Progression */}
      <div className={styles.xpSection}>
        <div className={styles.xpRow}>
          <span className={styles.xpLabel}>
            {levelInfo.title} • niveau {levelInfo.level}
          </span>
          <span className={styles.xpVal}>
            {levelInfo.currentXP} / {levelInfo.nextLevelXP} XP
          </span>
        </div>
        <div className={styles.xpBarBg}>
          <div className={styles.xpBarFill} style={{ width: `${levelInfo.percent}%` }} />
        </div>
      </div>

      {/* Statistiques */}
      <div className={styles.statsSection}>
        <div className={styles.statsGrid}>
          <div className={styles.statCard}>
            <div className={styles.statDeco}><Clapperboard size={26} /></div>
            <div className={styles.statLabel}>Films vus</div>
            <div className={styles.statVal}>{watchedCount}</div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statDeco}><Star size={26} /></div>
            <div className={styles.statLabel}>Note moyenne</div>
            <div className={styles.statVal}><Rating value={avgRating} /></div>
            <div className={styles.statSub}>sur {ratedCount} films notés</div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statDeco}><Clock size={26} /></div>
            <div className={styles.statLabel}>Heures visionnées</div>
            <div className={styles.statVal}>
              {totalHours}
              <span style={{ fontSize: 20 }}>h</span>
            </div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statDeco}><Heart size={26} fill="currentColor" /></div>
            <div className={styles.statLabel}>Favoris</div>
            <div className={styles.statVal}>{likedCount}</div>
            <div className={styles.statSub}>films aimés</div>
          </div>
        </div>
      </div>

      <div className={styles.content}>
        {favoriteFilms.length > 0 && (
          <div className={styles.section}>
            <div className={styles.sectionHead}>
              <h2 className={styles.sectionTitle}>Films préférés</h2>
            </div>
            <FilmGrid films={favoriteFilms} emptyTitle="" emptyHint="" />
          </div>
        )}

        <div className={styles.section}>
          <div className={styles.sectionHead}>
            <h2 className={styles.sectionTitle}>Films notés</h2>
          </div>
          <CollectionClient
            films={ratedFilms}
            total={ratedCount}
            type="rated"
            userId={id}
            emptyTitle={`${displayName} n'a encore noté aucun film.`}
            emptyHint=""
          />
        </div>
      </div>
    </div>
  );
}
