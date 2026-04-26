import { getSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import { fetchFilmCard, type TmdbFilmCard } from "@/lib/tmdb";
import Topbar from "../components/Topbar";
import CollectionClient from "../components/CollectionClient";
import styles from "../collection.module.css";

const PAGE_SIZE = 24;

export default async function WatchlistPage() {
  const session = await getSession();

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Bonjour" : hour < 18 ? "Bon après-midi" : "Bonsoir";

  const [total, entries, ratedCount] = session
    ? await Promise.all([
        prisma.userFilm.count({ where: { userId: session.userId, watchlist: true } }),
        prisma.userFilm.findMany({
          where: { userId: session.userId, watchlist: true },
          orderBy: { updatedAt: "desc" },
          take: PAGE_SIZE,
          select: { tmdbId: true, rating: true },
        }),
        prisma.userFilm.count({
          where: { userId: session.userId, watchlist: true, rating: { not: null } },
        }),
      ])
    : [0, [], 0];

  const films = (
    await Promise.all(
      entries.map(async (entry) => {
        const card = await fetchFilmCard(entry.tmdbId);
        if (!card) return null;
        return { ...card, rating: entry.rating ?? null };
      })
    )
  ).filter(Boolean) as Array<TmdbFilmCard & { rating: number | null }>;

  return (
    <div className={styles.page}>
      <Topbar greeting={greeting} userName={session?.name ?? null} />

      <div className={styles.header}>
        <div className={styles.sectionSub}>Ma bibliothèque</div>
        <h2 className={styles.sectionTitle}>À voir</h2>
      </div>

      {total > 0 && (
        <div className={styles.stats}>
          <div className={styles.stat}>
            <div className={styles.statVal}>{total}</div>
            <div className={styles.statLab}>Films à voir</div>
          </div>
          <div className={styles.stat}>
            <div className={styles.statVal}>{ratedCount}</div>
            <div className={styles.statLab}>Déjà notés</div>
          </div>
        </div>
      )}

      <CollectionClient
        films={films}
        total={total}
        type="watchlist"
        ratingField="voteAverage"
        emptyTitle="Votre liste est vide."
        emptyHint="Ajoutez des films depuis leur fiche en cliquant sur « Ajouter à la watchlist »."
      />
    </div>
  );
}
