"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import type { TmdbFilmCard } from "@/lib/tmdb";
import styles from "../film.module.css";

const PlusIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="28" height="28" strokeLinecap="round">
    <path d="M12 5v14M5 12h14" />
  </svg>
);
const MinusIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="28" height="28" strokeLinecap="round">
    <path d="M5 12h14" />
  </svg>
);

const INITIAL_COUNT = 8;

/**
 * Grille de films avec carte « N de plus » occupant un emplacement de la
 * grille, sur le même principe que le casting.
 */
export default function SimilarFilms({
  films,
  title,
  subtitle,
  hrefBase = "/film",
}: {
  films: TmdbFilmCard[];
  title: string;
  subtitle?: string;
  /** « /film » (défaut) ou « /series » — la fiche série réutilise cette grille. */
  hrefBase?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? films : films.slice(0, INITIAL_COUNT);
  const remaining = films.length - INITIAL_COUNT;

  return (
    <div className={styles.section}>
      <div className={styles.sectionTitle}>{title}</div>
      {subtitle && <div className={styles.sagaSub}>{subtitle}</div>}
      <div className={styles.similarGrid}>
        {visible.map((s) => (
          <Link key={s.id} href={`${hrefBase}/${s.id}`} className={styles.similarCard}>
            {s.posterUrl ? (
              <Image
                src={s.posterUrl}
                alt={s.title}
                className={styles.similarPoster}
                width={300}
                height={450}
                sizes="(max-width: 768px) 33vw, 160px"
                // height:auto neutralise l'attribut height (sinon il écrase l'aspect-ratio CSS)
                style={{ height: "auto" }}
              />
            ) : (
              <div className={styles.similarPosterEmpty} />
            )}
            <div className={styles.similarTitle}>{s.title}</div>
            {s.year && <div className={styles.similarYear}>{s.year}</div>}
          </Link>
        ))}

        {remaining > 0 && (
          <button
            className={`${styles.similarCard} ${styles.similarMoreCard}`}
            onClick={() => setExpanded((v) => !v)}
          >
            <div className={styles.similarMorePoster}>
              {expanded ? <MinusIcon /> : <PlusIcon />}
            </div>
            <div className={styles.similarTitle} style={{ textAlign: "center" }}>
              {expanded ? "Réduire" : `${remaining} de plus`}
            </div>
          </button>
        )}
      </div>
    </div>
  );
}
