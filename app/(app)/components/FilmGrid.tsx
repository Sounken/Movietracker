import Link from "next/link";
import Image from "next/image";
import type { TmdbFilmCard } from "@/lib/tmdb";
import styles from "./FilmGrid.module.css";
import { Rating } from "@/lib/rating-scale";

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
    // `stagger` (globals.css) : les affiches apparaissent en cascade plutôt
    // que d'un bloc — la grille se remplit au lieu de surgir.
    <div className={`${styles.grid} stagger`}>
      {films.map((film, i) => (
        <Link key={film.id} href={`/film/${film.id}`} className={styles.film}>
          <div className={styles.poster}>
            {film.posterUrl && (
              <Image
                /* Premières affiches au-dessus de la ligne de flottaison : chargées tout de suite (LCP) */
                loading={i < 6 ? "eager" : undefined}
                src={film.posterUrl}
                alt=""
                fill
                sizes="(max-width: 768px) 30vw, 200px"
                style={{ objectFit: "cover" }}
              />
            )}
            {film.voteAverage > 0 && (
              <div className={styles.tmdbRate} title="Note TMDB">★ <Rating value={film.voteAverage} /></div>
            )}
          </div>
          <div className={styles.info}>
            <div className={styles.title}>{film.title}</div>
            <div className={styles.meta}>
              {film.year && <span>{film.year}</span>}
              {film.year && film.genres[0] && <span>•</span>}
              {film.genres[0] && <span className={styles.genre}>{film.genres[0]}</span>}
              {film.rating !== null && <span>•</span>}
              {film.rating !== null && (
                <span className={styles.stars}>★ <Rating value={film.rating} outOf /></span>
              )}
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}
