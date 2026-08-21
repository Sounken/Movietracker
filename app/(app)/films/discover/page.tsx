import { Suspense } from "react";
import { getSession } from "@/lib/session";
import { fetchDiscover, fetchNowPlaying, fetchFilmLogo } from "@/lib/tmdb";
import { fetchForYouFilms } from "@/lib/recommendations";
import Topbar from "../../components/Topbar";
import HeroCarousel from "../../components/HeroCarousel";
import DiscoverFilters from "./DiscoverFilters";
import DiscoverGrid from "./DiscoverGrid";
import styles from "./discover.module.css";

export default async function DiscoverPage({
  searchParams,
}: {
  searchParams: Promise<{
    category?: string;
    genre?: string;
    minYear?: string;
    maxYear?: string;
    minRating?: string;
  }>;
}) {
  const [session, params] = await Promise.all([getSession(), searchParams]);

  const genre = params.genre ?? "";
  const genreId = genre ? parseInt(genre) : null;
  const minYear = params.minYear ?? "";
  const maxYear = params.maxYear ?? "";
  const minRating = params.minRating ?? "";

  // « Pour vous » n'a de sens qu'avec un compte : sinon on retombe sur Populaires.
  const requested = params.category ?? "popular";
  const category = requested === "for_you" && !session ? "popular" : requested;

  // Le carrousel des sorties n'est destiné qu'aux visiteurs non connectés :
  // les connectés l'ont déjà sur leur accueil. On évite donc aussi les appels TMDB.
  const showHero = !session;

  const [films, nowPlaying] = await Promise.all([
    category === "for_you" && session
      ? fetchForYouFilms(session.userId)
      : fetchDiscover(category, {
          genreId,
          minYear,
          maxYear,
          minRating: minRating ? Number(minRating) : undefined,
        }),
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
        <h2 className={styles.sectionTitle}>
          {category === "for_you" ? "Pour vous" : "Découvrir"}
        </h2>
      </div>

      <Suspense fallback={null}>
        <DiscoverFilters
          category={category}
          genre={genre}
          minYear={minYear}
          maxYear={maxYear}
          minRating={minRating}
          showForYou={Boolean(session)}
        />
      </Suspense>

      <DiscoverGrid
        key={`${category}-${genre}-${minYear}-${maxYear}-${minRating}`}
        initialFilms={films}
        category={category}
        genre={genre}
        minYear={minYear}
        maxYear={maxYear}
        minRating={minRating}
        emptyMessage={
          category === "for_you"
            ? "Notez quelques films pour que l'on puisse vous en conseiller."
            : undefined
        }
      />
    </div>
  );
}
