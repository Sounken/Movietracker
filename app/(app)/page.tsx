import { getSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import { fetchNowPlaying, fetchFilmCard } from "@/lib/tmdb";
import Topbar from "./components/Topbar";
import HeroCarousel from "./components/HeroCarousel";
import FilmGrid from "./components/FilmGrid";
import styles from "./dashboard.module.css";

export default async function DashboardPage() {
  const session = await getSession();

  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Bonjour" : hour < 18 ? "Bon après-midi" : "Bonsoir";

  const [nowPlaying, ratedEntries] = await Promise.all([
    fetchNowPlaying(),
    session
      ? prisma.userFilm.findMany({
          where: { userId: session.userId, rating: { not: null } },
          orderBy: { updatedAt: "desc" },
        })
      : Promise.resolve([]),
  ]);

  const ratedFilms = (
    await Promise.all(
      ratedEntries.map(async (entry) => {
        const card = await fetchFilmCard(entry.tmdbId);
        if (!card) return null;
        return { ...card, rating: entry.rating! };
      }),
    )
  ).filter(Boolean) as Array<{
    id: number;
    title: string;
    posterUrl: string;
    year: string;
    genres: string[];
    rating: number;
  }>;

  const avgRating =
    ratedEntries.length > 0
      ? (
          ratedEntries.reduce((s, e) => s + (e.rating ?? 0), 0) /
          ratedEntries.length
        ).toFixed(1)
      : null;

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
            <button className={`${styles.pill} ${styles.pillOn}`}>
              Cinémas
            </button>
            <button className={styles.pill}>Streaming</button>
            <button className={styles.pill}>Festivals</button>
          </div>
        </div>
      </section>

      {nowPlaying.length > 0 ? (
        <HeroCarousel movies={nowPlaying} />
      ) : (
        <div className={styles.noTmdb}>
          Ajoutez <code>TMDB_API_KEY</code> dans <code>.env.local</code> pour
          voir les films en salle.
        </div>
      )}

      <section>
        <div className={styles.sectionHead}>
          <div>
            <div className={styles.sectionSub}>02 — Ma collection</div>
            <h2 className={styles.sectionTitle}>Films notés</h2>
          </div>
        </div>

        {ratedEntries.length > 0 && (
          <div className={styles.stats}>
            <div className={styles.stat}>
              <div className={styles.statVal}>{ratedEntries.length}</div>
              <div className={styles.statLab}>Films notés</div>
            </div>
            {avgRating && (
              <div className={styles.stat}>
                <div className={styles.statVal}>{avgRating}/10</div>
                <div className={styles.statLab}>Note moyenne</div>
              </div>
            )}
          </div>
        )}

        <FilmGrid films={ratedFilms} />
      </section>
    </div>
  );
}
