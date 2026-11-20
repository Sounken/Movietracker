import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import { fetchOnTheAirSeries, fetchSeriesLogo } from "@/lib/tmdb";
import { getSeriesCards } from "@/lib/series";
import SeriesGrid, { type SeriesGridItem } from "../components/SeriesGrid";
import { Rating } from "@/lib/rating-scale";
import SeriesCollectionClient from "../components/SeriesCollectionClient";
import AddSeriesButton from "../components/AddSeriesButton";
import { HomeHero } from "../components/home/HomeHero";
import { delta, type StatItem } from "../components/home/stats";
import styles from "../components/home/home.module.css";

// ——— Helpers de statistiques (mêmes conventions que l'accueil films) ———

function formatHours(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60);
  if (h < 24) return `${h}h`;
  const days = Math.floor(h / 24);
  const rem = h % 24;
  return rem > 0 ? `${days}j ${rem}h` : `${days}j`;
}



/** Nombre d'entrées par mois calendaire, du plus ancien au plus récent. */
function countByMonth(entries: { updatedAt: Date }[], n: number): number[] {
  const now = new Date();
  return Array.from({ length: n }, (_, i) => {
    const y = new Date(now.getFullYear(), now.getMonth() - (n - 1 - i), 1);
    return entries.filter((e) => {
      const d = new Date(e.updatedAt);
      return d.getFullYear() === y.getFullYear() && d.getMonth() === y.getMonth();
    }).length;
  });
}

/** Nombre d'entrées par fenêtre glissante de 7 jours. */
function countByWeek(entries: { updatedAt: Date }[], n: number): number[] {
  const now = new Date();
  return Array.from({ length: n }, (_, i) => {
    const end = new Date(now);
    end.setDate(end.getDate() - i * 7);
    end.setHours(23, 59, 59, 999);
    const start = new Date(end);
    start.setDate(start.getDate() - 6);
    start.setHours(0, 0, 0, 0);
    return entries.filter((e) => {
      const d = new Date(e.updatedAt);
      return d >= start && d <= end;
    }).length;
  }).reverse();
}

// ——— Section 01 : carrousel des séries à l'affiche ———
async function HeroSection({ userId }: { userId: string | null }) {
  const onAir = await fetchOnTheAirSeries();
  if (onAir.length === 0) return null;

  const [logoEntries, watchlistEntries] = await Promise.all([
    Promise.all(onAir.map(async (m) => [m.id, await fetchSeriesLogo(m.id)] as const)),
    userId
      ? prisma.userSeries.findMany({
          where: { userId, watchlist: true, tmdbId: { in: onAir.map((m) => m.id) } },
          select: { tmdbId: true },
        })
      : Promise.resolve([]),
  ]);

  const logos = Object.fromEntries(
    logoEntries.filter((e): e is readonly [number, string] => e[1] !== null),
  ) as Record<number, string>;

  return (
    <HomeHero
      kind="series"
      kicker="Série du moment"
      queueLabel="Aussi à l'affiche"
      movies={onAir}
      logos={logos}
      watchlistIds={watchlistEntries.map((e) => e.tmdbId)}
    />
  );
}

// ——— Section « Reprendre » : séries commencées, pas terminées ———
async function InProgressSection({ userId }: { userId: string }) {
  const epGroups = await prisma.userEpisode.groupBy({
    by: ["seriesId"],
    where: { userId },
    _count: { _all: true },
  });
  if (epGroups.length === 0) return null;

  const progressIds = epGroups.map((g) => g.seriesId);
  const watchedMap = new Map(epGroups.map((g) => [g.seriesId, g._count._all]));

  const [cards, rows] = await Promise.all([
    getSeriesCards(progressIds),
    prisma.series.findMany({
      where: { tmdbId: { in: progressIds } },
      select: { tmdbId: true, numberOfEpisodes: true },
    }),
  ]);
  const totalMap = new Map(rows.map((r) => [r.tmdbId, r.numberOfEpisodes]));

  const inProgress = progressIds
    .map((id): (SeriesGridItem & { done: boolean }) | null => {
      const card = cards.get(id);
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

  if (inProgress.length === 0) return null;

  return (
    <section className={styles.section}>
      <h2 className={styles.h2}>Reprendre</h2>
      <SeriesGrid items={inProgress} />
    </section>
  );
}

// ——— Section « Ma collection » : stats + grille filtrable ———
// Stats et collection partagent la même requête Prisma : un seul boundary
// Suspense, sinon l'agrégation serait faite deux fois.
async function CollectionSection({ userId }: { userId: string }) {
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const [ratedEntries, totalRated, episodeEntries] = await Promise.all([
    prisma.userSeries.findMany({
      where: { userId, rating: { not: null } },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.userSeries.count({ where: { userId, rating: { not: null } } }),
    // Le temps de visionnage d'une série se compte en épisodes vus, pas en
    // « durée de la série » : un utilisateur au milieu de la saison 2 n'a pas
    // regardé les 62 épisodes.
    prisma.userEpisode.findMany({
      where: { userId },
      select: { runtime: true, watchedAt: true },
    }),
  ]);

  const ratedSlice = ratedEntries.slice(0, 24);
  const cards = await getSeriesCards(ratedSlice.map((e) => e.tmdbId));
  const initialItems = ratedSlice
    .map((entry) => {
      const card = cards.get(entry.tmdbId);
      if (!card) return null;
      return {
        id: entry.tmdbId,
        name: card.name,
        posterUrl: card.posterUrl,
        year: card.year,
        voteAverage: card.voteAverage,
        rating: entry.rating,
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  const avgRating =
    ratedEntries.length > 0
      ? ratedEntries.reduce((s, e) => s + (e.rating ?? 0), 0) / ratedEntries.length
      : null;

  const totalMinutes = episodeEntries.reduce((s, e) => s + (e.runtime ?? 0), 0);

  // ——— Courbes ———
  const seriesByMonth = countByMonth(ratedEntries, 6);
  const deltaSeries = seriesByMonth[5] - seriesByMonth[4];

  const last10ratings = ratedEntries.slice(0, 10).map((e) => e.rating ?? 0).reverse();
  const avgRecent = last10ratings.slice(-5).reduce((s, v) => s + v, 0) / Math.min(5, last10ratings.length || 1);
  const older = last10ratings.slice(0, -5);
  const avgPrev = older.reduce((s, v) => s + v, 0) / Math.max(1, older.length);
  const deltaRating = last10ratings.length >= 2 ? avgRecent - avgPrev : 0;

  // Épisodes vus par semaine, sur 4 semaines
  const episodesByWeek = countByWeek(
    episodeEntries.map((e) => ({ updatedAt: e.watchedAt })),
    4,
  );
  const deltaEpisodes = episodesByWeek[3] - episodesByWeek[2];

  const seriesByWeek = countByWeek(ratedEntries, 4);
  const deltaWeekly = seriesByWeek[3] - seriesByWeek[2];

  const seriesCeMois = ratedEntries.filter((e) => new Date(e.updatedAt) >= startOfMonth).length;

  const stats: StatItem[] = [
    { label: "Séries notées", value: ratedEntries.length, ...delta(deltaSeries, " ce mois") },
    { label: "Note moyenne", value: <Rating value={avgRating} />, ...delta(Number(deltaRating.toFixed(1)), "", 1) },
    { label: "Heures cumulées", value: totalMinutes > 0 ? formatHours(totalMinutes) : "—", ...delta(deltaEpisodes, " épis.") },
    { label: "Séries ce mois", value: seriesCeMois, ...delta(deltaWeekly, " cette sem.") },
  ];

  return (
    <>
      <div className={styles.collHead}>
        <h2 className={styles.h2}>Ma collection</h2>
        <span className={styles.spacer} />
        {ratedEntries.length > 0 &&
          stats.map((st) => (
            <div key={st.label} className={styles.statPill}>
              <span className={styles.statVal}>{st.value}</span>
              <span className={styles.statLab}>{st.label}</span>
              <span className={styles[`tone_${st.tone}`]}>{st.delta}</span>
            </div>
          ))}
        <AddSeriesButton />
      </div>
      <SeriesCollectionClient
        initialItems={initialItems}
        total={totalRated}
        showWatchlist
        emptyTitle="Vous n'avez encore noté aucune série."
      />
    </>
  );
}

export default async function SeriesHomePage() {
  const session = await getSession();
  // Comme pour les films : sans compte, l'accueil n'a que le carrousel à
  // montrer. « Découvrir » le reprend en tête, suivi du catalogue à explorer.
  if (!session) redirect("/series/discover");

  return (
    <div className={styles.page} data-hero>
      <Suspense fallback={<section className={`${styles.hero} ${styles.heroSkeleton}`} />}>
        <HeroSection userId={session.userId} />
      </Suspense>

      <div className={styles.below}>
        <Suspense fallback={null}>
          <InProgressSection userId={session.userId} />
        </Suspense>
        <Suspense fallback={<div className={`${styles.skeleton} skeletonBlock`} />}>
          <CollectionSection userId={session.userId} />
        </Suspense>
      </div>
    </div>
  );
}
