import { Suspense } from "react";
import { getSession } from "@/lib/session";
import { fetchDiscoverSeries } from "@/lib/tmdb";
import { fetchForYouSeries } from "@/lib/recommendations";
import Topbar from "../../components/Topbar";
import SeriesDiscoverFilters from "./SeriesDiscoverFilters";
import SeriesDiscoverGrid from "./SeriesDiscoverGrid";
import styles from "../../films/discover/discover.module.css";

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
  }>;
}) {
  const [session, params] = await Promise.all([getSession(), searchParams]);

  const genre = params.genre ?? "";
  const anime = params.anime === "1";
  const minYear = params.minYear ?? "";
  const maxYear = params.maxYear ?? "";
  const minRating = params.minRating ?? "";

  // Sans compte, « Pour vous » n'a rien sur quoi se baser : on retombe sur Populaires.
  const requested = params.category ?? "popular";
  const category = requested === "for_you" && !session ? "popular" : requested;

  const series =
    category === "for_you" && session
      ? await fetchForYouSeries(session.userId)
      : await fetchDiscoverSeries(category, {
          genreId: genre ? parseInt(genre) : null,
          anime,
          minYear,
          maxYear,
          minRating: minRating ? Number(minRating) : undefined,
        });

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Bonjour" : hour < 18 ? "Bon après-midi" : "Bonsoir";

  return (
    <div className={styles.page}>
      <Topbar greeting={greeting} userName={session?.name ?? null} />

      <div className={styles.header}>
        <div className={styles.sectionSub}>01 — Explorer</div>
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
          showForYou={Boolean(session)}
        />
      </Suspense>

      <SeriesDiscoverGrid
        key={`${category}-${genre}-${anime}-${minYear}-${maxYear}-${minRating}`}
        initialSeries={series}
        category={category}
        genre={genre}
        anime={anime}
        minYear={minYear}
        maxYear={maxYear}
        minRating={minRating}
        emptyMessage={
          category === "for_you"
            ? "Notez quelques séries pour que l'on puisse vous en conseiller."
            : undefined
        }
      />
    </div>
  );
}
