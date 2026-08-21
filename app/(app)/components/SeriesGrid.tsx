import Link from "next/link";
import Image from "next/image";
import styles from "../films/discover/discover.module.css";
import { Rating } from "@/lib/rating-scale";

export type SeriesGridItem = {
  id: number;
  name: string;
  posterUrl: string;
  year: string;
  voteAverage: number;
  caption?: string; // texte sous le titre (ex. progression ou note) — sinon l'année
};

export default function SeriesGrid({
  items,
  empty,
}: {
  items: SeriesGridItem[];
  empty?: string;
}) {
  if (items.length === 0) {
    return empty ? <div className={styles.empty}>{empty}</div> : null;
  }
  return (
    // Même apparition en cascade que la grille de films (cf. globals.css)
    <div className={`${styles.grid} stagger`}>
      {items.map((s) => (
        <Link key={s.id} href={`/series/${s.id}`} className={styles.filmCard}>
          <div className={styles.poster}>
            {s.posterUrl && (
              <Image
                src={s.posterUrl}
                alt=""
                fill
                sizes="(max-width: 768px) 50vw, 200px"
                style={{ objectFit: "cover" }}
              />
            )}
            {s.voteAverage > 0 && <div className={styles.score}>★ <Rating value={s.voteAverage} /></div>}
          </div>
          <div className={styles.info}>
            <div className={styles.title}>{s.name}</div>
            <div className={styles.year}>{s.caption ?? s.year}</div>
          </div>
        </Link>
      ))}
    </div>
  );
}
