import { Suspense } from "react";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import { ArrowUp, ArrowDown } from "lucide-react";
import { fetchOnTheAirSeries, fetchSeriesLogo } from "@/lib/tmdb";
import { getSeriesCards } from "@/lib/series";
import Topbar from "../components/Topbar";
import HeroCarousel from "../components/HeroCarousel";
import SeriesGrid, { type SeriesGridItem } from "../components/SeriesGrid";
import SeriesCollectionClient from "../components/SeriesCollectionClient";
import AddSeriesButton from "../components/AddSeriesButton";
import styles from "../films/dashboard.module.css";
import { Rating } from "@/lib/rating-scale";

// ——— Helpers de statistiques (mêmes conventions que l'accueil films) ———

function formatHours(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60);
  if (h < 24) return `${h}h`;
  const days = Math.floor(h / 24);
  const rem = h % 24;
  return rem > 0 ? `${days}j ${rem}h` : `${days}j`;
}

function Sparkline({ points }: { points: number[] }) {
  if (points.length < 2) return null;
  const W = 96, H = 30;
  const max = Math.max(...points);
  const min = Math.min(...points);
  const range = max - min || 1;
  const step = W / (points.length - 1);
  const d = points
    .map((p, i) => {
      const x = (i * step).toFixed(1);
      const y = (H - ((p - min) / range) * (H - 6) - 3).toFixed(1);
      return `${i === 0 ? "M" : "L"} ${x} ${y}`;
    })
    .join(" ");
  return (
    <svg className={styles.spark} width={W} height={H} viewBox={`0 0 ${W} ${H}`} aria-hidden="true">
      <path d={d} fill="none" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Delta({ value, suffix = "", decimals = 0 }: { value: number; suffix?: string; decimals?: number }) {
  if (value === 0) return <span className={styles.deltaFlat}>= stable</span>;
  const up = value > 0;
  return (
    <span className={up ? styles.deltaUp : styles.deltaDown}>
      {up ? <ArrowUp size={11} /> : <ArrowDown size={11} />}
      {up ? "+" : ""}{Math.abs(value).toFixed(decimals)}{suffix}
    </span>
  );
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
    <HeroCarousel
      movies={onAir}
      logos={logos}
      initialWatchlist={watchlistEntries.map((e) => e.tmdbId)}
      kind="series"
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
    <section>
      <div className={styles.sectionHead}>
        <div>
          <div className={styles.sectionSub}>02 — Reprendre</div>
          <h2 className={styles.sectionTitle}>Séries en cours</h2>
        </div>
      </div>
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

  return (
    <>
      {ratedEntries.length > 0 && (
        <div className={`${styles.stats} stagger`}>
          <div className={styles.stat}>
            <div className={styles.statLab}>Séries notées</div>
            <div className={styles.statVal}>{ratedEntries.length}</div>
            <Delta value={deltaSeries} suffix=" ce mois" />
            <Sparkline points={seriesByMonth} />
          </div>

          <div className={styles.stat}>
            <div className={styles.statLab}>Note moyenne</div>
            <div className={styles.statVal}><Rating value={avgRating || null} outOf /></div>
            <Delta value={Number(deltaRating.toFixed(1))} decimals={1} />
            <Sparkline points={last10ratings} />
          </div>

          <div className={styles.stat}>
            <div className={styles.statLab}>Heures cumulées</div>
            <div className={styles.statVal}>{totalMinutes > 0 ? formatHours(totalMinutes) : "—"}</div>
            <Delta value={deltaEpisodes} suffix=" épis. cette sem." />
            <Sparkline points={episodesByWeek} />
          </div>

          <div className={styles.stat}>
            <div className={styles.statLab}>Séries ce mois</div>
            <div className={styles.statVal}>{seriesCeMois}</div>
            <Delta value={deltaWeekly} suffix=" cette sem." />
            <Sparkline points={seriesByWeek} />
          </div>
        </div>
      )}

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

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Bonjour" : hour < 18 ? "Bon après-midi" : "Bonsoir";

  return (
    <div className={styles.page}>
      <Topbar greeting={greeting} userName={session?.name ?? null} />

      <section>
        <div className={styles.sectionHead}>
          <div>
            <div className={styles.sectionSub}>01 — À l&apos;affiche</div>
            <h2 className={styles.sectionTitle}>Séries du moment</h2>
          </div>
        </div>
      </section>

      <Suspense fallback={<div className={`${styles.skeleton} ${styles.skeletonHero}`} />}>
        <HeroSection userId={session?.userId ?? null} />
      </Suspense>

      {session && (
        <>
          <Suspense fallback={null}>
            <InProgressSection userId={session.userId} />
          </Suspense>

          <section>
            <div className={styles.sectionHead}>
              <div>
                <div className={styles.sectionSub}>03 — Ma collection</div>
                <h2 className={styles.sectionTitle}>Séries notées</h2>
              </div>
              <div className={styles.sectionActions}>
                <AddSeriesButton />
              </div>
            </div>

            <Suspense
              fallback={
                <>
                  <div className={`${styles.skeleton} ${styles.skeletonStats}`} />
                  <div className={`${styles.skeleton} ${styles.skeletonGrid}`} />
                </>
              }
            >
              <CollectionSection userId={session.userId} />
            </Suspense>
          </section>
        </>
      )}
    </div>
  );
}
