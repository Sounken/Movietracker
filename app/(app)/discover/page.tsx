import { Suspense } from "react";
import { getSession } from "@/lib/session";
import { fetchDiscover } from "@/lib/tmdb";
import Topbar from "../components/Topbar";
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

  const films = await fetchDiscover(category, genreId);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Bonjour" : hour < 18 ? "Bon après-midi" : "Bonsoir";

  return (
    <div className={styles.page}>
      <Topbar greeting={greeting} userName={session?.name ?? null} />

      <div className={styles.header}>
        <div className={styles.sectionSub}>03 — Explorer</div>
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
