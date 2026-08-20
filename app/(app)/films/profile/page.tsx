import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { Clapperboard, Star, Clock, Heart, ClipboardList, ArrowUp } from "lucide-react";
import type { UserFilm } from "@/app/generated/prisma/client";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import { type TmdbFilmCard } from "@/lib/tmdb";
import { getFilmCards } from "@/lib/films";
import ProfileHeaderClient from "./ProfileHeaderClient";
import FavFilmsClient from "./FavFilmsClient";
import CollectionClient from "../../components/CollectionClient";
import AddFilmButton from "../../components/AddFilmButton";
import ImportButton from "./ImportButton";
import { computeXP, getLevelInfo } from "@/lib/xp";
import styles from "./profile.module.css";
import { Rating } from "@/lib/rating-scale";
import { toRatingScale } from "@/lib/rating";

// Cartes de stats — compteurs/agrégations Prisma, streamées.
// Réutilise filmEntries déjà chargé par la page (pas de requête dupliquée).
async function StatsSection({ userId, filmEntries }: { userId: string; filmEntries: UserFilm[] }) {
  const [watchedCount, ratedCount, watchlistCount, likedCount, runtimeAgg] = await Promise.all([
    prisma.userFilm.count({ where: { userId, watched: true } }),
    prisma.userFilm.count({ where: { userId, rating: { not: null } } }),
    prisma.userFilm.count({ where: { userId, watchlist: true } }),
    prisma.userFilm.count({ where: { userId, liked: true } }),
    prisma.userFilm.aggregate({
      where: { userId, runtime: { not: null } },
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

  return (
    <div className={styles.statsSection}>
      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <div className={styles.statDeco}><Clapperboard size={26} /></div>
          <div className={styles.statLabel}>Films vus</div>
          <div className={styles.statVal}>{watchedCount}</div>
          <div className={styles.statSub}><ArrowUp size={12} /> +{watchedThisMonth} ce mois</div>
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
          <div className={styles.statVal}>{totalHours}<span style={{ fontSize: 20 }}>h</span></div>
          <div className={styles.statSub}><ArrowUp size={12} /> +{hoursThisWeek.toFixed(1)}h cette semaine</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statDeco}><Heart size={26} fill="currentColor" /></div>
          <div className={styles.statLabel}>Favoris</div>
          <div className={styles.statVal}>{likedCount}</div>
          <div className={styles.statSub}>films aimés</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statDeco}><ClipboardList size={26} /></div>
          <div className={styles.statLabel}>À voir</div>
          <div className={styles.statVal}>{watchlistCount}</div>
          <div className={styles.statSub}>dans la watchlist</div>
        </div>
      </div>
    </div>
  );
}

// 4 films préférés — requête Prisma + getFilmCards, streamés
async function FavFilmsSection({ userId }: { userId: string }) {
  const favoriteEntries = await prisma.userFavoriteFilm.findMany({
    where: { userId },
    orderBy: { position: "asc" },
  });

  const favoriteCards = await getFilmCards(favoriteEntries.map((e) => e.tmdbId));
  const favoriteFilms = [1, 2, 3, 4].map((pos) => {
    const entry = favoriteEntries.find((e) => e.position === pos);
    if (!entry) return { position: pos, tmdbId: null, title: null, posterUrl: null, year: null };
    const film = favoriteCards.get(entry.tmdbId);
    return {
      position: pos,
      tmdbId: entry.tmdbId,
      title: film?.title ?? null,
      posterUrl: film?.posterUrl ?? null,
      year: film?.year ?? null,
    };
  });

  return (
    <FavFilmsClient
      slots={favoriteFilms.map((f) => ({ ...f, position: f.position as 1 | 2 | 3 | 4 }))}
    />
  );
}

// Collection — films notés uniquement (comme l'accueil) ; la watchlist a son
// propre bouton dans la barre d'outils. Première page seulement, la suite se charge à la demande.
// Réutilise filmEntries déjà chargé par la page (pas de requête dupliquée).
async function CollectionSection({ filmEntries }: { filmEntries: UserFilm[] }) {
  const collectionEntries = filmEntries.filter((e) => e.rating !== null);
  const totalCollection = collectionEntries.length;
  const collectionSlice = collectionEntries.slice(0, 24);
  const collectionCards = await getFilmCards(collectionSlice.map((e) => e.tmdbId));
  const collectionFilms = collectionSlice
    .map((entry) => {
      const card = collectionCards.get(entry.tmdbId);
      if (!card) return null;
      return { ...card, rating: entry.rating ?? null };
    })
    .filter(Boolean) as Array<TmdbFilmCard & { rating: number | null }>;

  return (
    <CollectionClient
      films={collectionFilms}
      total={totalCollection}
      type="rated"
      showWatchlist
    />
  );
}

export default async function ProfilePage() {
  const session = await getSession();
  if (!session) redirect("/login");

  // En-tête immédiat : user + entries (nécessaires à l'XP) — deux requêtes légères.
  const [user, filmEntries] = await Promise.all([
    prisma.user.findUnique({ where: { id: session.userId } }),
    prisma.userFilm.findMany({
      where: { userId: session.userId },
      orderBy: { updatedAt: "desc" },
    }),
  ]);

  if (!user) notFound();

  const levelInfo = getLevelInfo(computeXP(filmEntries));

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
        ratingScale={toRatingScale(user.ratingScale)}
        extraActions={<ImportButton />}
      />

      {/* Stats grid — streamé */}
      <Suspense
        fallback={
          <div className={styles.statsSection}>
            <div className={`${styles.skeleton} ${styles.skeletonStats}`} />
          </div>
        }
      >
        <StatsSection userId={session.userId} filmEntries={filmEntries} />
      </Suspense>

      <div className={styles.content}>
        {/* Favorite films */}
        <div className={styles.section}>
          <div className={styles.sectionHead}>
            <h2 className={styles.sectionTitle}>Films préférés</h2>
          </div>
          <Suspense fallback={<div className={`${styles.skeleton} ${styles.skeletonFavs}`} />}>
            <FavFilmsSection userId={session.userId} />
          </Suspense>
        </div>

        {/* Collection */}
        <div className={styles.section}>
          <div className={styles.sectionHead}>
            <h2 className={styles.sectionTitle}>Ma collection</h2>
            <AddFilmButton />
          </div>
          <Suspense fallback={<div className={`${styles.skeleton} ${styles.skeletonGrid}`} />}>
            <CollectionSection filmEntries={filmEntries} />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
