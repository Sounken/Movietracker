import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { getUserWatchProviders } from "@/lib/user-settings";
import { fetchDiscover, fetchNowPlaying, fetchFilmLogo } from "@/lib/tmdb";
import { fetchForYouFilms } from "@/lib/recommendations";
import { parseProviders } from "@/lib/watch-providers";
import { discoverQuery, parseDiscoverParams } from "@/lib/discover-params";
import { getFilmLibraryStatus } from "@/lib/library-status";
import HeroCarousel from "../../components/HeroCarousel";
import DiscoverFilters from "./DiscoverFilters";
import DiscoverGrid from "./DiscoverGrid";
import styles from "./discover.module.css";

export const metadata: Metadata = {
  title: "Découvrir des films : populaires, mieux notés, au cinéma",
  description:
    "Explorez les films populaires, les mieux notés et les sorties en salles. Filtrez par genre, année, note ou plateforme de streaming : Netflix, Prime Video, Disney+…",
  // Les filtres passent par l'URL : sans canonique, chaque combinaison serait
  // une page distincte pour Google.
  alternates: { canonical: "/films/discover" },
};

export default async function DiscoverPage({
  searchParams,
}: {
  searchParams: Promise<{
    category?: string;
    genre?: string;
    minYear?: string;
    maxYear?: string;
    minRating?: string;
    providers?: string;
  }>;
}) {
  const [session, raw] = await Promise.all([getSession(), searchParams]);

  // Les filtres invalides sont déjà redirigés par le proxy ; ce renvoi n'est
  // qu'un filet si la page était atteinte autrement.
  const { params, valid } = parseDiscoverParams((k) => raw[k as keyof typeof raw], "movie");
  if (!valid) redirect(`/films/discover${discoverQuery(params)}`);

  const { genre, minYear, maxYear, minRating, providers } = params;
  const genreId = genre ? Number(genre) : null;

  // « Pour vous » n'a de sens qu'avec un compte : sinon on retombe sur Populaires.
  const category = params.category === "for_you" && !session ? "popular" : params.category;

  // Le carrousel des sorties n'est destiné qu'aux visiteurs non connectés :
  // les connectés l'ont déjà sur leur accueil. On évite donc aussi les appels TMDB.
  const showHero = !session;

  const [films, nowPlaying, libraryStatus, myProviders] = await Promise.all([
    category === "for_you" && session
      ? fetchForYouFilms(session.userId)
      : fetchDiscover(category, {
          genreId,
          minYear,
          maxYear,
          minRating: minRating ? Number(minRating) : undefined,
          providers: parseProviders(providers),
        }),
    showHero ? fetchNowPlaying() : Promise.resolve([]),
    getFilmLibraryStatus(session?.userId ?? null),
    getUserWatchProviders(session?.userId),
  ]);

  // Logos officiels des films du carrousel (repli sur le titre texte si absent)
  const heroLogos = Object.fromEntries(
    (
      await Promise.all(
        nowPlaying.map(async (m) => [m.id, await fetchFilmLogo(m.id)] as const),
      )
    ).filter((entry): entry is readonly [number, string] => entry[1] !== null),
  ) as Record<number, string>;

  return (
    <div className={styles.page}>
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
          providers={providers}
          showForYou={Boolean(session)}
          myProviders={session ? myProviders : null}
        />
      </Suspense>

      <DiscoverGrid
        key={`${category}-${genre}-${minYear}-${maxYear}-${minRating}-${providers}`}
        initialFilms={films}
        category={category}
        genre={genre}
        minYear={minYear}
        maxYear={maxYear}
        minRating={minRating}
        providers={providers}
        libraryStatus={libraryStatus}
        emptyMessage={
          category === "for_you"
            ? "Notez quelques films pour que l'on puisse vous en conseiller."
            : undefined
        }
      />
    </div>
  );
}
