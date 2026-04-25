import { getSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import { fetchFilmCard } from "@/lib/tmdb";
import Topbar from "../components/Topbar";
import FilmGrid from "../components/FilmGrid";
import styles from "../collection.module.css";

export default async function FavoritesPage() {
  const session = await getSession();

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Bonjour" : hour < 18 ? "Bon après-midi" : "Bonsoir";

  const entries = session
    ? await prisma.userFilm.findMany({
        where: { userId: session.userId, liked: true },
        orderBy: { updatedAt: "desc" },
      })
    : [];

  const films = (
    await Promise.all(
      entries.map(async (entry) => {
        const card = await fetchFilmCard(entry.tmdbId);
        if (!card) return null;
        return { ...card, rating: entry.rating ?? null };
      }),
    )
  ).filter(Boolean) as Array<{
    id: number;
    title: string;
    posterUrl: string;
    year: string;
    genres: string[];
    rating: number | null;
  }>;

  return (
    <div className={styles.page}>
      <Topbar greeting={greeting} userName={session?.name ?? null} />

      <div className={styles.header}>
        <div className={styles.sectionSub}>Ma bibliothèque</div>
        <h2 className={styles.sectionTitle}>Favoris</h2>
      </div>

      {films.length > 0 && (
        <div className={styles.stats}>
          <div className={styles.stat}>
            <div className={styles.statVal}>{films.length}</div>
            <div className={styles.statLab}>Films favoris</div>
          </div>
          <div className={styles.stat}>
            <div className={styles.statVal}>
              {films.filter((f) => f.rating !== null).length}
            </div>
            <div className={styles.statLab}>Notés</div>
          </div>
        </div>
      )}

      <FilmGrid
        films={films}
        emptyTitle="Aucun film en favori."
        emptyHint="Ajoutez des films depuis leur fiche en cliquant sur le cœur."
      />
    </div>
  );
}
