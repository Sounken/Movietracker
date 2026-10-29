import type { Metadata } from "next";
import { Suspense } from "react";
import { getSession } from "@/lib/session";
import { fetchDiscoverSeries, fetchOnTheAirSeries, fetchSeriesLogo } from "@/lib/tmdb";
import { fetchForYouSeries } from "@/lib/recommendations";
import { parseProviders } from "@/lib/watch-providers";
import { getSeriesLibraryStatus } from "@/lib/library-status";
import Topbar from "../../components/Topbar";
import HeroCarousel from "../../components/HeroCarousel";
import SeriesDiscoverFilters from "./SeriesDiscoverFilters";
import SeriesDiscoverGrid from "./SeriesDiscoverGrid";
import styles from "../../films/discover/discover.module.css";
import { getGreeting } from "@/lib/greeting";

export const metadata: Metadata = {
  title: "Découvrir des séries : du moment, populaires, mieux notées",
  description:
    "Les séries du moment, les plus populaires et les mieux notées. Filtrez par genre, année, note ou plateforme de streaming : Netflix, Prime Video, Disney+…",
  // Les filtres passent par l'URL : sans canonique, chaque combinaison serait
  // une page distincte pour Google.
  alternates: { canonical: "/series/discover" },
};

export default async function SeriesDiscoverPage({
  searchParams,
}: {
  searchParams: Promise<{
    category?: string;
    genre?: string;
    anime?: string;
    minYear?: string;
    maxYear?: string;
    minRating?: string;
    providers?: string;
  }>;
}) {
  const [session, params] = await Promise.all([getSession(), searchParams]);

  const genre = params.genre ?? "";
  const anime = params.anime === "1";
  const minYear = params.minYear ?? "";
  const maxYear = params.maxYear ?? "";
  const minRating = params.minRating ?? "";
  const providers = params.providers ?? "";

  // Sans compte, « Pour vous » n'a rien sur quoi se baser : on retombe sur Populaires.
  const requested = params.category ?? "popular";
  const category = requested === "for_you" && !session ? "popular" : requested;

  // Le carrousel n'est destiné qu'aux visiteurs non connectés, comme sur
  // « Découvrir » côté films : les connectés l'ont déjà sur leur accueil.
  const showHero = !session;

  const [series, onAir, libraryStatus] = await Promise.all([
    category === "for_you" && session
      ? fetchForYouSeries(session.userId)
      : fetchDiscoverSeries(category, {
          genreId: genre ? parseInt(genre) : null,
          anime,
          minYear,
          maxYear,
          minRating: minRating ? Number(minRating) : undefined,
          providers: parseProviders(providers),
        }),
    showHero ? fetchOnTheAirSeries() : Promise.resolve([]),
    getSeriesLibraryStatus(session?.userId ?? null),
  ]);

  const heroLogos = Object.fromEntries(
    (
      await Promise.all(onAir.map(async (m) => [m.id, await fetchSeriesLogo(m.id)] as const))
    ).filter((entry): entry is readonly [number, string] => entry[1] !== null),
  ) as Record<number, string>;

  const greeting = getGreeting();

  return (
    <div className={styles.page}>
      <Topbar greeting={greeting} userName={session?.name ?? null} />

      {showHero && onAir.length > 0 && (
        <>
          <div className={styles.header}>
            <div className={styles.sectionSub}>01 — À l&apos;affiche</div>
            <h2 className={styles.sectionTitle}>Séries du moment</h2>
          </div>

          <HeroCarousel movies={onAir} logos={heroLogos} kind="series" />
        </>
      )}

      <div className={styles.header}>
        <div className={styles.sectionSub}>
          {showHero && onAir.length > 0 ? "02" : "01"} — Explorer
        </div>
        <h2 className={styles.sectionTitle}>
          {category === "for_you" ? "Pour vous" : "Découvrir des séries"}
        </h2>
      </div>

      <Suspense fallback={null}>
        <SeriesDiscoverFilters
          category={category}
          genre={genre}
          anime={anime}
          minYear={minYear}
          maxYear={maxYear}
          minRating={minRating}
          providers={providers}
          showForYou={Boolean(session)}
        />
      </Suspense>

      <SeriesDiscoverGrid
        key={`${category}-${genre}-${anime}-${minYear}-${maxYear}-${minRating}-${providers}`}
        initialSeries={series}
        category={category}
        genre={genre}
        anime={anime}
        minYear={minYear}
        maxYear={maxYear}
        minRating={minRating}
        providers={providers}
        libraryStatus={libraryStatus}
        emptyMessage={
          category === "for_you"
            ? "Notez quelques séries pour que l'on puisse vous en conseiller."
            : undefined
        }
      />
    </div>
  );
}
