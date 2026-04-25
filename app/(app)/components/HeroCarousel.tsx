"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import type { TmdbMovie } from "@/lib/tmdb";
import { genreLabels } from "@/lib/tmdb";
import styles from "./HeroCarousel.module.css";

const StarIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" width="10" height="10">
    <path d="m12 2 3 7 7 .5-5.5 4.5L18 22l-6-4-6 4 1.5-8L2 9.5 9 9z" />
  </svg>
);
const ExternalIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" width="14" height="14">
    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14 21 3" />
  </svg>
);
const PlusIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" width="14" height="14">
    <path d="M12 5v14M5 12h14" />
  </svg>
);
const PrevIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" width="15" height="15">
    <path d="m15 18-6-6 6-6" />
  </svg>
);
const NextIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" width="15" height="15">
    <path d="m9 18 6-6-6-6" />
  </svg>
);

const DURATION = 6000;

export default function HeroCarousel({ movies }: { movies: TmdbMovie[] }) {
  const [idx, setIdx] = useState(0);
  const [prog, setProg] = useState(0);
  const n = movies.length;

  useEffect(() => {
    if (!n) return;
    setProg(0);
    const start = Date.now();
    const interval = setInterval(() => {
      const p = Math.min(((Date.now() - start) / DURATION) * 100, 100);
      setProg(p);
      if (p >= 100) setIdx((i) => (i + 1) % n);
    }, 60);
    return () => clearInterval(interval);
  }, [idx, n]);

  const go = (d: number) => setIdx((i) => (i + d + n) % n);

  if (!n) return null;
  const cur = movies[idx];
  const genres = genreLabels(cur.genreIds);
  const words = cur.title.split(" ");

  return (
    <div className={styles.wrap}>
      <div
        className={styles.bg}
        style={{ backgroundImage: cur.backdropUrl ? `url("${cur.backdropUrl}")` : undefined }}
      />

      <div className={styles.content}>
        <div className={styles.lab}>Sortie de la semaine</div>
        <div className={styles.title}>
          <em>{words[0]}</em>{words.length > 1 ? " " + words.slice(1).join(" ") : ""}
        </div>
        <div className={styles.meta}>
          {cur.year && <span>{cur.year}</span>}
          {cur.year && genres.length > 0 && <span className={styles.sep} />}
          {genres.length > 0 && <span>{genres.join(" · ")}</span>}
          {cur.voteAverage > 0 && (
            <span className={styles.score}>
              <StarIcon /> {cur.voteAverage}/10
            </span>
          )}
        </div>
        {cur.overview && <p className={styles.synopsis}>{cur.overview}</p>}
        <div className={styles.actions}>
          <Link href={`/film/${cur.id}`} className={styles.btnPrimary}>
            <ExternalIcon /> Voir la fiche
          </Link>
          <button className={styles.btnGhost}>
            <PlusIcon /> Ma liste
          </button>
        </div>
      </div>

      {cur.posterUrl && (
        <div
          className={styles.poster}
          style={{ backgroundImage: `url("${cur.posterUrl}")` }}
        />
      )}

      <div className={styles.rail}>
        {movies.map((m, i) => (
          <div
            key={m.id}
            className={`${styles.thumb} ${i === idx ? styles.thumbOn : ""}`}
            style={{ backgroundImage: m.posterUrl ? `url("${m.posterUrl}")` : undefined }}
            onClick={() => setIdx(i)}
          />
        ))}
        <div className={styles.arrows}>
          <button className={styles.arrow} onClick={() => go(-1)}>
            <PrevIcon />
          </button>
          <button className={styles.arrow} onClick={() => go(1)}>
            <NextIcon />
          </button>
        </div>
      </div>

      <div className={styles.progress}>
        <div className={styles.progressFill} style={{ width: `${prog}%` }} />
      </div>
    </div>
  );
}
