import { Suspense } from "react";
import { getSession } from "@/lib/session";
import { getFilmTrends, parsePeriod, type Period } from "@/lib/trends";
import Topbar from "../../components/Topbar";
import TrendsClient from "./TrendsClient";
import styles from "./trends.module.css";

// Toutes les données de la page viennent d'une seule agrégation (cachée) :
// un seul boundary Suspense pour tout le contenu, la Topbar reste immédiate.
async function TrendsContent({ period }: { period: Period }) {
  const data = await getFilmTrends(period);

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
    />
  );
}

export default async function TrendsPage({
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
        <TrendsContent period={period} />
      </Suspense>
    </div>
  );
}
