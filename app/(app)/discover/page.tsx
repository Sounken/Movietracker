import { Suspense } from "react";
import { getSession } from "@/lib/session";
import { fetchDiscover, fetchNowPlaying, fetchFilmLogo } from "@/lib/tmdb";
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

  // Le carrousel des sorties n'est destiné qu'aux visiteurs non connectés :
  // les connectés l'ont déjà sur leur accueil. On évite donc aussi les appels TMDB.
  const showHero = !session;

  const [films, nowPlaying] = await Promise.all([
    fetchDiscover(category, genreId),
    showHero ? fetchNowPlaying() : Promise.resolve([]),
  ]);

  // Logos officiels des films du carrousel (repli sur le titre texte si absent)
  const heroLogos = Object.fromEntries(
    (
      await Promise.all(
        nowPlaying.map(async (m) => [m.id, await fetchFilmLogo(m.id)] as const),
      )
    ).filter((entry): entry is readonly [number, string] => entry[1] !== null),
  ) as Record<number, string>;

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Bonjour" : hour < 18 ? "Bon après-midi" : "Bonsoir";

  return (
    <div className={styles.page}>
      <Topbar greeting={greeting} userName={session?.name ?? null} />

      {showHero && nowPlaying.length > 0 && (
        <>
          <div className={styles.header}>
            <div className={styles.sectionSub}>01 — Sorties récentes</div>
            <h2 className={styles.sectionTitle}>Cette semaine en salles</h2>
          </div>

          <HeroCarousel movies={nowPlaying} logos={heroLogos} />
        </>
      )}

      <div className={styles.header}>
        {/* la numérotation suit : « 02 » seulement si le bandeau « 01 » est affiché */}
        <div className={styles.sectionSub}>
          {showHero && nowPlaying.length > 0 ? "02" : "01"} — Explorer
        </div>
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
