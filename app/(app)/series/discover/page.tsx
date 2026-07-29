import Link from "next/link";
import { getSession } from "@/lib/session";
import { fetchDiscoverSeries } from "@/lib/tmdb";
import Topbar from "../../components/Topbar";
import SeriesDiscoverGrid from "./SeriesDiscoverGrid";
import styles from "../../films/discover/discover.module.css";

const CATEGORIES = [
  { key: "popular", label: "Populaires" },
  { key: "top_rated", label: "Mieux notées" },
  { key: "on_the_air", label: "En diffusion" },
];

export default async function SeriesDiscoverPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; anime?: string }>;
}) {
  const [session, params] = await Promise.all([getSession(), searchParams]);
  const category = params.category ?? "popular";
  const anime = params.anime === "1";

  const series = await fetchDiscoverSeries(category, null, 1, anime);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Bonjour" : hour < 18 ? "Bon après-midi" : "Bonsoir";

  const hrefFor = (cat: string, an: boolean) => {
    const p = new URLSearchParams();
    if (cat !== "popular") p.set("category", cat);
    if (an) p.set("anime", "1");
    const q = p.toString();
    return `/series/discover${q ? `?${q}` : ""}`;
  };

  return (
    <div className={styles.page}>
      <Topbar greeting={greeting} userName={session?.name ?? null} />

      <div className={styles.header}>
        <div className={styles.sectionSub}>01 — Explorer</div>
        <h2 className={styles.sectionTitle}>Découvrir des séries</h2>
      </div>

      <div className={styles.categoryTabs}>
        {CATEGORIES.map((c) => (
          <Link
            key={c.key}
            href={hrefFor(c.key, anime)}
            className={`${styles.tab} ${category === c.key ? styles.tabOn : ""}`}
          >
            {c.label}
          </Link>
        ))}
        <Link
          href={hrefFor(category, !anime)}
          className={`${styles.pill} ${anime ? styles.pillOn : ""}`}
        >
          Anime
        </Link>
      </div>

      <SeriesDiscoverGrid
        key={`${category}-${anime}`}
        initialSeries={series}
        category={category}
        anime={anime}
      />
    </div>
  );
}
