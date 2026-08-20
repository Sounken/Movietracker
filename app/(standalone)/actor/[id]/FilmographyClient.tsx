"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import type { TmdbPersonCredit, CreditDepartment } from "@/lib/tmdb";
import styles from "./actor.module.css";
import { Rating } from "@/lib/rating-scale";

type SortKey = "date" | "note" | "popularite";
type FilterKey = "all" | CreditDepartment;

const SORT_LABELS: Record<SortKey, string> = {
  date: "Date",
  note: "Notes",
  popularite: "Popularité",
};

const FILTER_LABELS: Record<FilterKey, string> = {
  all: "Tout",
  directing: "Réalisation",
  writing: "Scénario",
  production: "Production",
  acting: "Rôles",
  other: "Technique",
};

export default function FilmographyClient({
  credits,
  /**
   * Métier mis en avant par défaut. Sur la fiche d'un réalisateur, on ouvre
   * directement sur ses films réalisés : c'est ce qu'on vient y chercher.
   */
  defaultFilter = "all",
}: {
  credits: TmdbPersonCredit[];
  defaultFilter?: FilterKey;
}) {
  const [sort, setSort] = useState<SortKey>("date");
  const [filter, setFilter] = useState<FilterKey>(defaultFilter);

  // Onglets réellement utiles : on n'affiche que les métiers présents.
  const available = useMemo(() => {
    const counts = new Map<FilterKey, number>();
    for (const c of credits) counts.set(c.department, (counts.get(c.department) ?? 0) + 1);
    return (Object.keys(FILTER_LABELS) as FilterKey[])
      .filter((k) => k === "all" || (counts.get(k) ?? 0) > 0)
      .map((k) => ({ key: k, count: k === "all" ? credits.length : (counts.get(k) ?? 0) }));
  }, [credits]);

  const sorted = useMemo(() => {
    return credits
      .filter((c) => filter === "all" || c.department === filter)
      .sort((a, b) => {
        if (sort === "date") return (parseInt(b.year) || 0) - (parseInt(a.year) || 0);
        if (sort === "note") return b.voteAverage - a.voteAverage;
        return b.popularity - a.popularity;
      });
  }, [credits, sort, filter]);

  return (
    <div className={styles.section}>
      <div className={styles.sectionTitle}>
        Filmographie
        <span className={styles.sectionCount}>{sorted.length}</span>
      </div>
      {available.length > 2 && (
        <div className={styles.sortPills}>
          {available.map(({ key, count }) => (
            <button
              key={key}
              className={`${styles.sortPill} ${filter === key ? styles.sortPillActive : ""}`}
              onClick={() => setFilter(key)}
            >
              {FILTER_LABELS[key]} <span className={styles.pillCount}>{count}</span>
            </button>
          ))}
        </div>
      )}
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
            <Image
              src={film.posterUrl}
              alt={film.title}
              className={styles.filmPoster}
              width={300}
              height={450}
              sizes="(max-width: 768px) 33vw, 160px"
              // height:auto neutralise l'attribut height (sinon il écrase l'aspect-ratio CSS)
              style={{ height: "auto" }}
            />
            {film.voteAverage > 0 && (
              <div className={styles.filmScore}>★ <Rating value={film.voteAverage} /></div>
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
