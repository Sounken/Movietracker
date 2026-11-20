import type { Metadata } from "next";
import { Suspense } from "react";
import { getSeriesTrends, parsePeriod, type Period } from "@/lib/trends";
import TrendsClient from "../../films/trends/TrendsClient";
import styles from "../../films/trends/trends.module.css";

export const metadata: Metadata = {
  title: "Tendances séries : les plus suivies et les mieux notées",
  description:
    "Les séries les plus suivies, les plus aimées et les mieux notées par les membres de MovieTracker, sur la période de votre choix.",
  // Les filtres passent par l'URL : sans canonique, chaque combinaison serait
  // une page distincte pour Google.
  alternates: { canonical: "/series/trends" },
};

// Même architecture que les tendances films : une seule agrégation cachée,
// un seul boundary Suspense.
async function SeriesTrendsContent({ period }: { period: Period }) {
  const data = await getSeriesTrends(period);

  return (
    <TrendsClient
      period={period}
      stats={data.stats}
      topWatched={data.topWatched}
      topLiked={data.topLiked}
      topRated={data.topRated}
      topWatchlisted={data.topWatchlisted}
      genres={data.genres}
      recentReviews={data.recentReviews}
      activeUsers={data.activeUsers}
      basePath="/series/trends"
      mediaBase="/series"
      media="series"
    />
  );
}

export default async function SeriesTrendsPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const { period: periodParam } = await searchParams;
  const period = parsePeriod(periodParam);

  return (
    <div>
      <Suspense
        fallback={
          <div className={styles.page}>
            <div className={`${styles.skeleton} ${styles.skeletonStats}`} />
            <div className={`${styles.skeleton} ${styles.skeletonMain}`} />
          </div>
        }
      >
        <SeriesTrendsContent period={period} />
      </Suspense>
    </div>
  );
}
