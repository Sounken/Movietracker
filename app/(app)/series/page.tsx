import { getSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import { fetchDiscoverSeries } from "@/lib/tmdb";
import { getSeriesCards } from "@/lib/series";
import Topbar from "../components/Topbar";
import SeriesGrid, { type SeriesGridItem } from "../components/SeriesGrid";
import discover from "../films/discover/discover.module.css";

export default async function SeriesHomePage() {
  const session = await getSession();

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Bonjour" : hour < 18 ? "Bon après-midi" : "Bonsoir";

  // Découverte (toujours affichée)
  const popular = await fetchDiscoverSeries("popular", null, 1, false);
  const popularItems: SeriesGridItem[] = popular.slice(0, 12).map((s) => ({
    id: s.id,
    name: s.name,
    posterUrl: s.posterUrl,
    year: s.year,
    voteAverage: s.voteAverage,
  }));

  let inProgress: SeriesGridItem[] = [];
  let rated: SeriesGridItem[] = [];

  if (session) {
    const [epGroups, ratedSeries] = await Promise.all([
      prisma.userEpisode.groupBy({
        by: ["seriesId"],
        where: { userId: session.userId },
        _count: { _all: true },
      }),
      prisma.userSeries.findMany({
        where: { userId: session.userId, rating: { not: null } },
        orderBy: { updatedAt: "desc" },
        take: 12,
        select: { tmdbId: true, rating: true },
      }),
    ]);

    // ——— En cours : séries commencées mais pas terminées ———
    const progressIds = epGroups.map((g) => g.seriesId);
    const watchedMap = new Map(epGroups.map((g) => [g.seriesId, g._count._all]));
    const [progressCards, seriesRows] = await Promise.all([
      getSeriesCards(progressIds),
      prisma.series.findMany({
        where: { tmdbId: { in: progressIds } },
        select: { tmdbId: true, numberOfEpisodes: true },
      }),
    ]);
    const totalMap = new Map(seriesRows.map((r) => [r.tmdbId, r.numberOfEpisodes]));

    inProgress = progressIds
      .map((id): (SeriesGridItem & { done: boolean }) | null => {
        const card = progressCards.get(id);
        if (!card) return null;
        const watched = watchedMap.get(id) ?? 0;
        const total = totalMap.get(id) ?? 0;
        return {
          id,
          name: card.name,
          posterUrl: card.posterUrl,
          year: card.year,
          voteAverage: card.voteAverage,
          caption: total > 0 ? `${watched}/${total} épisodes` : `${watched} épisodes vus`,
          done: total > 0 && watched >= total,
        };
      })
      .filter((x): x is SeriesGridItem & { done: boolean } => x !== null && !x.done)
      .slice(0, 12);

    // ——— Séries notées ———
    const ratedCards = await getSeriesCards(ratedSeries.map((r) => r.tmdbId));
    rated = ratedSeries
      .map((r): SeriesGridItem | null => {
        const card = ratedCards.get(r.tmdbId);
        if (!card) return null;
        return {
          id: r.tmdbId,
          name: card.name,
          posterUrl: card.posterUrl,
          year: card.year,
          voteAverage: card.voteAverage,
          caption: `Ma note : ${r.rating}/10`,
        };
      })
      .filter((x): x is SeriesGridItem => x !== null);
  }

  return (
    <div className={discover.page}>
      <Topbar greeting={greeting} userName={session?.name ?? null} />

      {inProgress.length > 0 && (
        <section>
          <div className={discover.header}>
            <div className={discover.sectionSub}>01 — Reprendre</div>
            <h2 className={discover.sectionTitle}>Séries en cours</h2>
          </div>
          <SeriesGrid items={inProgress} />
        </section>
      )}

      {rated.length > 0 && (
        <section>
          <div className={discover.header}>
            <div className={discover.sectionSub}>{inProgress.length > 0 ? "02" : "01"} — Ma collection</div>
            <h2 className={discover.sectionTitle}>Séries notées</h2>
          </div>
          <SeriesGrid items={rated} />
        </section>
      )}

      <section>
        <div className={discover.header}>
          <div className={discover.sectionSub}>
            {(inProgress.length > 0 ? 1 : 0) + (rated.length > 0 ? 1 : 0) + 1 < 10
              ? String((inProgress.length > 0 ? 1 : 0) + (rated.length > 0 ? 1 : 0) + 1).padStart(2, "0")
              : "03"}{" "}
            — Découvrir
          </div>
          <h2 className={discover.sectionTitle}>Populaires en ce moment</h2>
        </div>
        <SeriesGrid items={popularItems} empty="Aucune série à afficher." />
      </section>
    </div>
  );
}
