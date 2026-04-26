import { getSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import { fetchNowPlaying, fetchFilmCard, type TmdbFilmCard } from "@/lib/tmdb";
import Topbar from "./components/Topbar";
import HeroCarousel from "./components/HeroCarousel";
import CollectionClient from "./components/CollectionClient";
import AddFilmButton from "./components/AddFilmButton";
import styles from "./dashboard.module.css";

function formatHours(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60);
  if (h < 24) return `${h}h`;
  const days = Math.floor(h / 24);
  const rem = h % 24;
  return rem > 0 ? `${days}j ${rem}h` : `${days}j`;
}

// Tiny sparkline SVG — no axes, just the curve
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
      {up ? "↑ +" : "↓ "}{Math.abs(value).toFixed(decimals)}{suffix}
    </span>
  );
}

// Group entries by calendar month — returns array of counts (oldest → newest)
function countByMonth(entries: { updatedAt: Date }[], n: number): number[] {
  const now = new Date();
  return Array.from({ length: n }, (_, i) => {
    const y = new Date(now.getFullYear(), now.getMonth() - (n - 1 - i), 1);
    return entries.filter(e => {
      const d = new Date(e.updatedAt);
      return d.getFullYear() === y.getFullYear() && d.getMonth() === y.getMonth();
    }).length;
  });
}

// Sum runtime (minutes) per 7-day window going back n weeks
function runtimeByWeek(entries: { updatedAt: Date; runtime: number | null }[], n: number): number[] {
  const now = new Date();
  return Array.from({ length: n }, (_, i) => {
    const end = new Date(now);
    end.setDate(end.getDate() - i * 7);
    const start = new Date(end);
    start.setDate(start.getDate() - 6);
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
    return entries
      .filter(e => {
        const d = new Date(e.updatedAt);
        return d >= start && d <= end && e.runtime;
      })
      .reduce((s, e) => s + (e.runtime ?? 0), 0) / 60;
  }).reverse();
}

export default async function DashboardPage() {
  const session = await getSession();

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Bonjour" : hour < 18 ? "Bon après-midi" : "Bonsoir";

  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const [nowPlaying, ratedEntries, runtimeAgg, totalRated] = await Promise.all([
    fetchNowPlaying(),
    session
      ? prisma.userFilm.findMany({
          where: { userId: session.userId, rating: { not: null } },
          orderBy: { updatedAt: "desc" },
        })
      : Promise.resolve([]),
    session
      ? prisma.userFilm.aggregate({
          where: { userId: session.userId, runtime: { not: null } },
          _sum: { runtime: true },
        })
      : Promise.resolve({ _sum: { runtime: null } }),
    session
      ? prisma.userFilm.count({ where: { userId: session.userId, rating: { not: null } } })
      : Promise.resolve(0),
  ]);

  // Only fetch TMDB cards for the first 24 — rest loads on demand
  const ratedFilms = (
    await Promise.all(
      ratedEntries.slice(0, 24).map(async (entry) => {
        const card = await fetchFilmCard(entry.tmdbId);
        if (!card) return null;
        return { ...card, rating: entry.rating! };
      }),
    )
  ).filter(Boolean) as Array<TmdbFilmCard & { rating: number }>;

  const avgRating =
    ratedEntries.length > 0
      ? ratedEntries.reduce((s, e) => s + (e.rating ?? 0), 0) / ratedEntries.length
      : null;

  const totalMinutes = runtimeAgg._sum?.runtime ?? 0;

  // ——— Sparkline data ———
  // Films notés : count par mois sur 6 mois
  const filmsByMonth = countByMonth(ratedEntries, 6);
  const deltaFilms = filmsByMonth[5] - filmsByMonth[4];

  // Note moyenne : courbe des 10 derniers films (chronologique)
  const last10ratings = ratedEntries.slice(0, 10).map(e => e.rating ?? 0).reverse();
  const avgRecent = last10ratings.slice(-5).reduce((s, v) => s + v, 0) / Math.min(5, last10ratings.length);
  const avgPrev = last10ratings.slice(0, -5).reduce((s, v) => s + v, 0) / Math.max(1, last10ratings.slice(0, -5).length);
  const deltaRating = last10ratings.length >= 2 ? avgRecent - avgPrev : 0;

  // Heures cumulées : sum runtime par semaine sur 4 semaines
  const hoursByWeek = runtimeByWeek(ratedEntries, 4);
  const deltaHours = hoursByWeek[3] - hoursByWeek[2];

  // Films ce mois : count par semaine (4 semaines glissantes)
  const filmsByWeekDirect = Array.from({ length: 4 }, (_, i) => {
    const now = new Date();
    const end = new Date(now);
    end.setDate(end.getDate() - i * 7);
    end.setHours(23, 59, 59, 999);
    const start = new Date(end);
    start.setDate(start.getDate() - 6);
    start.setHours(0, 0, 0, 0);
    return ratedEntries.filter(e => {
      const d = new Date(e.updatedAt);
      return d >= start && d <= end;
    }).length;
  }).reverse();
  const deltaWeeklyFilms = filmsByWeekDirect[3] - filmsByWeekDirect[2];

  const filmsCeMois = ratedEntries.filter(e => new Date(e.updatedAt) >= startOfMonth).length;

  return (
    <div className={styles.page}>
      <Topbar greeting={greeting} userName={session?.name ?? null} />

      <section>
        <div className={styles.sectionHead}>
          <div>
            <div className={styles.sectionSub}>01 — Sorties récentes</div>
            <h2 className={styles.sectionTitle}>Cette semaine en salles</h2>
          </div>
          <div className={styles.pills}>
            <button className={`${styles.pill} ${styles.pillOn}`}>Cinémas</button>
            <button className={styles.pill}>Streaming</button>
            <button className={styles.pill}>Festivals</button>
          </div>
        </div>
      </section>

      {nowPlaying.length > 0 ? (
        <HeroCarousel movies={nowPlaying} />
      ) : (
        <div className={styles.noTmdb}>
          Ajoutez <code>TMDB_API_KEY</code> dans <code>.env.local</code> pour voir les films en salle.
        </div>
      )}

      <section>
        <div className={styles.sectionHead}>
          <div>
            <div className={styles.sectionSub}>02 — Ma collection</div>
            <h2 className={styles.sectionTitle}>Films notés</h2>
          </div>
          <div className={styles.sectionActions}>
            <AddFilmButton />
          </div>
        </div>

        {ratedEntries.length > 0 && (
          <div className={styles.stats}>
            <div className={styles.stat}>
              <div className={styles.statLab}>Films notés</div>
              <div className={styles.statVal}>{ratedEntries.length}</div>
              <Delta value={deltaFilms} suffix=" ce mois" />
              <Sparkline points={filmsByMonth} />
            </div>

            <div className={styles.stat}>
              <div className={styles.statLab}>Note moyenne</div>
              <div className={styles.statVal}>{avgRating ? avgRating.toFixed(1) : "—"}/10</div>
              <Delta value={Number(deltaRating.toFixed(1))} suffix="" decimals={1} />
              <Sparkline points={last10ratings} />
            </div>

            <div className={styles.stat}>
              <div className={styles.statLab}>Heures cumulées</div>
              <div className={styles.statVal}>{totalMinutes > 0 ? formatHours(totalMinutes) : "—"}</div>
              <Delta value={Number(deltaHours.toFixed(1))} suffix="h" decimals={1} />
              <Sparkline points={hoursByWeek} />
            </div>

            <div className={styles.stat}>
              <div className={styles.statLab}>Films ce mois</div>
              <div className={styles.statVal}>{filmsCeMois}</div>
              <Delta value={deltaWeeklyFilms} suffix=" cette sem." />
              <Sparkline points={filmsByWeekDirect} />
            </div>
          </div>
        )}

        <CollectionClient films={ratedFilms} total={totalRated} />
      </section>
    </div>
  );
}
