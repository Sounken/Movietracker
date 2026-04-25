import Link from "next/link";
import type { TmdbFilmCard } from "@/lib/tmdb";
import styles from "./FilmGrid.module.css";

const StarIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" width="10" height="10">
    <path d="m12 2 3 7 7 .5-5.5 4.5L18 22l-6-4-6 4 1.5-8L2 9.5 9 9z" />
  </svg>
);

type RatedFilm = TmdbFilmCard & { rating: number | null };

export default function FilmGrid({
  films,
  emptyTitle = "Aucun film ici pour l'instant.",
  emptyHint,
}: {
  films: RatedFilm[];
  emptyTitle?: string;
  emptyHint?: string;
}) {
  if (films.length === 0) {
    return (
      <div className={styles.empty}>
        <p>{emptyTitle}</p>
        {emptyHint && <p className={styles.emptyHint}>{emptyHint}</p>}
      </div>
    );
  }

  return (
    <div className={styles.grid}>
      {films.map((film) => (
        <Link key={film.id} href={`/film/${film.id}`} className={styles.film}>
          <div
            className={styles.poster}
            style={film.posterUrl ? { backgroundImage: `url("${film.posterUrl}")` } : undefined}
          >
            {film.rating !== null && (
              <div className={styles.myRate}>
                <StarIcon /> {film.rating}
              </div>
            )}
            <div className={styles.quick}>
              <span>Voir fiche</span>
            </div>
          </div>
          <div className={styles.info}>
            <div className={styles.title}>{film.title}</div>
            <div className={styles.meta}>
              {film.year && <span>{film.year}</span>}
              {film.year && film.genres[0] && <span>·</span>}
              {film.genres[0] && <span>{film.genres[0]}</span>}
              {film.rating !== null && <span>·</span>}
              {film.rating !== null && (
                <span className={styles.stars}>★ {film.rating}/10</span>
              )}
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}
