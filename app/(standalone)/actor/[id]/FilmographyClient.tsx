"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import type { TmdbPersonCredit } from "@/lib/tmdb";
import styles from "./actor.module.css";

type SortKey = "date" | "note" | "popularite";

const SORT_LABELS: Record<SortKey, string> = {
  date: "Date",
  note: "Notes",
  popularite: "Popularité",
};

export default function FilmographyClient({
  credits,
}: {
  credits: TmdbPersonCredit[];
}) {
  const [sort, setSort] = useState<SortKey>("date");

  const sorted = useMemo(() => {
    return [...credits].sort((a, b) => {
      if (sort === "date") return (parseInt(b.year) || 0) - (parseInt(a.year) || 0);
      if (sort === "note") return b.voteAverage - a.voteAverage;
      return b.popularity - a.popularity;
    });
  }, [credits, sort]);

  return (
    <div className={styles.section}>
      <div className={styles.sectionTitle}>
        Filmographie complète
        <span className={styles.sectionCount}>{credits.length}</span>
      </div>
      <div className={styles.sortPills}>
        {(Object.keys(SORT_LABELS) as SortKey[]).map((key) => (
          <button
            key={key}
            className={`${styles.sortPill} ${sort === key ? styles.sortPillActive : ""}`}
            onClick={() => setSort(key)}
          >
            {SORT_LABELS[key]}
          </button>
        ))}
      </div>
      <div className={styles.filmGrid}>
        {sorted.map((film) => (
          <Link key={`${film.id}-${film.character}`} href={`/film/${film.id}`} className={styles.filmCard}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={film.posterUrl} alt={film.title} className={styles.filmPoster} />
            {film.voteAverage > 0 && (
              <div className={styles.filmScore}>★ {film.voteAverage}</div>
            )}
            <div className={styles.filmInfo}>
              <div className={styles.filmTitle}>{film.title}</div>
              <div className={styles.filmYear}>{film.year}</div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
