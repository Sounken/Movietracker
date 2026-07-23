import { Suspense } from "react";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import { fetchDiscover, fetchNowPlaying } from "@/lib/tmdb";
import Topbar from "../components/Topbar";
import HeroCarousel from "../components/HeroCarousel";
import DiscoverFilters from "./DiscoverFilters";
import DiscoverGrid from "./DiscoverGrid";
import styles from "./discover.module.css";

export default async function DiscoverPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; genre?: string }>;
}) {
  const [session, params] = await Promise.all([getSession(), searchParams]);

  const category = params.category ?? "popular";
  const genre = params.genre ?? "";
  const genreId = genre ? parseInt(genre) : null;

  const [films, nowPlaying] = await Promise.all([
    fetchDiscover(category, genreId),
    fetchNowPlaying(),
  ]);

  // Films du carrousel déjà en watchlist (si connecté) → bouton synchronisé
  const heroWatchlistIds =
    session && nowPlaying.length > 0
      ? (
          await prisma.userFilm.findMany({
            where: {
              userId: session.userId,
              watchlist: true,
              tmdbId: { in: nowPlaying.map((m) => m.id) },
            },
            select: { tmdbId: true },
          })
        ).map((e) => e.tmdbId)
      : [];

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Bonjour" : hour < 18 ? "Bon après-midi" : "Bonsoir";

  return (
    <div className={styles.page}>
      <Topbar greeting={greeting} userName={session?.name ?? null} />

      {nowPlaying.length > 0 && (
        <>
          <div className={styles.header}>
            <div className={styles.sectionSub}>01 — Sorties récentes</div>
            <h2 className={styles.sectionTitle}>Cette semaine en salles</h2>
          </div>

          <HeroCarousel movies={nowPlaying} initialWatchlist={heroWatchlistIds} />
        </>
      )}

      <div className={styles.header}>
        <div className={styles.sectionSub}>02 — Explorer</div>
        <h2 className={styles.sectionTitle}>Découvrir</h2>
      </div>

      <Suspense fallback={null}>
        <DiscoverFilters category={category} genre={genre} />
      </Suspense>

      <DiscoverGrid
        key={`${category}-${genre}`}
        initialFilms={films}
        category={category}
        genre={genre}
      />
    </div>
  );
}
