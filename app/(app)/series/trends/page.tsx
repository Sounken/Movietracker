import { unstable_cache } from "next/cache";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import { getSeriesCards } from "@/lib/series";
import Topbar from "../../components/Topbar";
import SeriesGrid, { type SeriesGridItem } from "../../components/SeriesGrid";
import discover from "../../films/discover/discover.module.css";

// Données communautaires (identiques pour tous) → mises en cache 10 min.
const getSeriesTrends = unstable_cache(
  async () => {
    const [topWatched, topRated, topWatchlisted] = await Promise.all([
      prisma.userSeries.groupBy({
        by: ["tmdbId"],
        where: { watched: true },
        _count: { tmdbId: true },
        orderBy: { _count: { tmdbId: "desc" } },
        take: 12,
      }),
      prisma.userSeries.groupBy({
        by: ["tmdbId"],
        where: { rating: { not: null } },
        _count: { tmdbId: true },
        _avg: { rating: true },
        orderBy: { _avg: { rating: "desc" } },
        take: 12,
      }),
      prisma.userSeries.groupBy({
        by: ["tmdbId"],
        where: { watchlist: true },
        _count: { tmdbId: true },
        orderBy: { _count: { tmdbId: "desc" } },
        take: 12,
      }),
    ]);

    const ids = [
      ...new Set([
        ...topWatched.map((x) => x.tmdbId),
        ...topRated.map((x) => x.tmdbId),
        ...topWatchlisted.map((x) => x.tmdbId),
      ]),
    ];
    const cards = await getSeriesCards(ids);

    const build = (
      rows: { tmdbId: number; _count: { tmdbId: number }; _avg?: { rating: number | null } }[],
      kind: "watched" | "rated" | "watchlist",
    ): SeriesGridItem[] =>
      rows
        .map((r): SeriesGridItem | null => {
          const c = cards.get(r.tmdbId);
          if (!c) return null;
          const caption =
            kind === "rated"
              ? `★ ${(r._avg?.rating ?? 0).toFixed(1)} moyenne`
              : kind === "watchlist"
                ? `${r._count.tmdbId} en watchlist`
                : `${r._count.tmdbId} spectateur${r._count.tmdbId > 1 ? "s" : ""}`;
          return {
            id: c.id,
            name: c.name,
            posterUrl: c.posterUrl,
            year: c.year,
            voteAverage: c.voteAverage,
            caption,
          };
        })
        .filter((x): x is SeriesGridItem => x !== null);

    return {
      watched: build(topWatched, "watched"),
      rated: build(topRated, "rated"),
      watchlisted: build(topWatchlisted, "watchlist"),
    };
  },
  ["series-trends"],
  { revalidate: 600 },
);

export default async function SeriesTrendsPage() {
  const session = await getSession();
  const data = await getSeriesTrends();

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Bonjour" : hour < 18 ? "Bon après-midi" : "Bonsoir";

  return (
    <div className={discover.page}>
      <Topbar greeting={greeting} userName={session?.name ?? null} />

      <div className={discover.header}>
        <div className={discover.sectionSub}>Communauté</div>
        <h2 className={discover.sectionTitle}>Tendances séries</h2>
      </div>

      <section>
        <div className={discover.header}>
          <div className={discover.sectionSub}>Les plus suivies</div>
        </div>
        <SeriesGrid items={data.watched} empty="Pas encore de données." />
      </section>

      <section>
        <div className={discover.header}>
          <div className={discover.sectionSub}>Les mieux notées</div>
        </div>
        <SeriesGrid items={data.rated} empty="Pas encore de données." />
      </section>

      <section>
        <div className={discover.header}>
          <div className={discover.sectionSub}>Les plus attendues</div>
        </div>
        <SeriesGrid items={data.watchlisted} empty="Pas encore de données." />
      </section>
    </div>
  );
}
