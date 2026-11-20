"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { genreLabels, type TmdbMovie } from "@/lib/tmdb";
import { Rating } from "@/lib/rating-scale";
import { useCarousel, useWatchlist, type HomeKind } from "./hooks";
import styles from "./nocturne.module.css";

const DURATION = 8000;

export function NocturneHero({
  kind = "film",
  kicker = "Sortie de la semaine",
  movies,
  logos,
  watchlistIds,
  sourceLabel,
  switchHref,
  switchLabel,
  queueLabel = "Aussi cette semaine",
}: {
  kind?: HomeKind;
  kicker?: string;
  movies: TmdbMovie[];
  logos: Record<number, string>;
  watchlistIds: number[];
  sourceLabel?: string;
  /** Bascule Cinémas / Streaming ; absente sur l'accueil Séries. */
  switchHref?: string;
  switchLabel?: string;
  queueLabel?: string;
}) {
  const n = movies.length;
  const { idx, setIdx } = useCarousel(n, DURATION);
  const wl = useWatchlist(watchlistIds, kind);
  const base = kind === "series" ? "/series" : "/film";
  const [brokenLogos, setBrokenLogos] = useState<Set<number>>(new Set());

  // Fondu enchaîné : l'image précédente reste dessous pendant que la nouvelle
  // apparaît (ajusté pendant le rendu, comme `HeroCarousel`).
  const [layers, setLayers] = useState<{ prev: number | null; cur: number }>({ prev: null, cur: 0 });
  if (layers.cur !== idx) setLayers({ prev: layers.cur, cur: idx });

  const cur = movies[idx];
  const genres = genreLabels(cur.genreIds).slice(0, 2);
  const upNext = Array.from({ length: Math.min(4, n - 1) }, (_, k) => (idx + 1 + k) % n);
  const inList = wl.has(cur.id);

  return (
    <section className={styles.hero}>
      {[layers.prev, layers.cur].map((i) =>
        i === null || !movies[i].backdropUrl ? null : (
          <div key={movies[i].id} className={`${styles.layer} ${i === idx ? styles.layerIn : ""}`}>
            <div className={styles.kb}>
              <Image src={movies[i].backdropUrl} alt="" fill priority={i === 0} sizes="100vw" style={{ objectFit: "cover" }} />
            </div>
          </div>
        ),
      )}
      <div className={styles.veil} />

      <div className={styles.heroText} key={cur.id}>
        <div className={styles.kicker}>
          <span className={styles.dot} />
          {kicker}{sourceLabel ? ` • ${sourceLabel}` : ""}
        </div>
        {logos[cur.id] && !brokenLogos.has(cur.id) ? (
          <Image
            src={logos[cur.id]}
            alt={cur.title}
            className={styles.logo}
            width={0}
            height={0}
            sizes="520px"
            // Logo du film affiché : souvent l'élément le plus grand de l'écran (LCP)
            loading="eager"
            onError={() => setBrokenLogos((prev) => new Set(prev).add(cur.id))}
          />
        ) : (
          <h1 className={styles.title} style={{ fontSize: cur.title.length > 16 ? 64 : 104 }}>{cur.title}</h1>
        )}
        <div className={styles.meta}>
          {cur.year && <span>{cur.year}</span>}
          {genres.length > 0 && <span>{genres.join(", ")}</span>}
          {cur.voteAverage > 0 && (
            <span className={styles.score}>
              ★ <Rating value={cur.voteAverage} />
            </span>
          )}
        </div>
        {cur.overview && <p className={styles.synopsis}>{cur.overview}</p>}
        <div className={styles.actions}>
          <Link href={`${base}/${cur.id}`} className={`${styles.btn} ${styles.btnP}`}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 5l12 7-12 7z" /></svg>
            Voir la fiche
          </Link>
          <button className={`${styles.btn} ${styles.btnS}`} onClick={() => wl.toggle(cur.id)} disabled={wl.pending}>
            {inList ? "✓ Dans À voir" : "+ À voir"}
          </button>
        </div>
      </div>

      {upNext.length > 0 && (
        <div className={styles.queue}>
          <div className={styles.queueHead}>
            <span>{queueLabel}</span>
            {switchHref && (
              <Link href={switchHref} scroll={false} className={styles.queueSwitch}>{switchLabel} →</Link>
            )}
          </div>
          {upNext.map((i) => (
            <button key={movies[i].id} className={styles.queueItem} onClick={() => setIdx(i)}>
              <span className={styles.queueThumb}>
                {movies[i].backdropUrl && (
                  <Image src={movies[i].backdropUrl} alt="" fill sizes="72px" style={{ objectFit: "cover" }} />
                )}
              </span>
              <span className={styles.queueTitle}>{movies[i].title}</span>
            </button>
          ))}
        </div>
      )}

      <div className={styles.segs}>
        {movies.map((m, i) => (
          <button
            key={m.id}
            className={`${styles.seg} ${i === idx ? styles.segOn : ""}`}
            onClick={() => setIdx(i)}
            aria-label={`Afficher ${m.title}`}
          >
            {i === idx && <span key={idx} className={styles.segFill} style={{ animationDuration: `${DURATION}ms` }} />}
          </button>
        ))}
      </div>
    </section>
  );
}
