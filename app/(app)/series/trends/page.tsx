import { Suspense } from "react";
import { getSession } from "@/lib/session";
import { getSeriesTrends, parsePeriod, type Period } from "@/lib/trends";
import Topbar from "../../components/Topbar";
import TrendsClient from "../../films/trends/TrendsClient";
import styles from "../../films/trends/trends.module.css";

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
  const [session, { period: periodParam }] = await Promise.all([getSession(), searchParams]);
  const period = parsePeriod(periodParam);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Bonjour" : hour < 18 ? "Bon après-midi" : "Bonsoir";

  return (
    <div>
      <Topbar greeting={greeting} userName={session?.name ?? null} />
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
