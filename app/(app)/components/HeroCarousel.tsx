"use client";

import { useState, useEffect, useTransition } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import type { TmdbMovie } from "@/lib/tmdb";
import { genreLabels } from "@/lib/tmdb";
import { toggleWatchlist } from "@/app/actions/film";
import { toggleSeriesWatchlist } from "@/app/actions/series";
import styles from "./HeroCarousel.module.css";
import { Rating } from "@/lib/rating-scale";

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
const CheckIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" width="14" height="14">
    <path d="m5 13 4 4L19 7" />
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

export default function HeroCarousel({
  movies,
  initialWatchlist = [],
  logos = {},
  kind = "film",
}: {
  movies: TmdbMovie[];
  initialWatchlist?: number[];
  /** Logos officiels par tmdbId ; absent = on affiche le titre texte. */
  logos?: Record<number, string>;
  /** « film » (défaut) → /film/[id] + watchlist films ; « series » → /series/[id] + watchlist séries. */
  kind?: "film" | "series";
}) {
  const detailBase = kind === "series" ? "/series" : "/film";
  const [idx, setIdx] = useState(0);
  const [prog, setProg] = useState(0);
  // Changement de slide → la progression repart à zéro, ajustée pendant le
  // rendu (pattern React « ajuster l'état pendant le rendu ») plutôt que dans un effet.
  const [prevIdx, setPrevIdx] = useState(0);
  if (idx !== prevIdx) {
    setPrevIdx(idx);
    setProg(0);
  }
  // Logos dont le chargement a échoué → repli sur le titre texte
  const [brokenLogos, setBrokenLogos] = useState<Set<number>>(new Set());
  // État réel de la watchlist, initialisé depuis le serveur
  const [inWatchlist, setInWatchlist] = useState<Set<number>>(new Set(initialWatchlist));
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const n = movies.length;

  function handleWatchlist(id: number) {
    const wasIn = inWatchlist.has(id);

    // Mise à jour optimiste (ajout ou retrait)
    setInWatchlist((prev) => {
      const next = new Set(prev);
      if (wasIn) next.delete(id);
      else next.add(id);
      return next;
    });

    startTransition(async () => {
      try {
        await (kind === "series" ? toggleSeriesWatchlist : toggleWatchlist)(id);
      } catch {
        // Échec (ex. non connecté) → on annule l'affichage optimiste
        setInWatchlist((prev) => {
          const next = new Set(prev);
          if (wasIn) next.add(id);
          else next.delete(id);
          return next;
        });
        router.push("/login");
      }
    });
  }

  useEffect(() => {
    if (!n) return;
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
      <div className={styles.bg}>
        {cur.backdropUrl && (
          <Image
            src={cur.backdropUrl}
            alt=""
            fill
            priority
            sizes="100vw"
            style={{ objectFit: "cover" }}
          />
        )}
      </div>

      <div className={styles.content}>
        <div className={styles.lab}>{kind === "series" ? "Série du moment" : "Sortie de la semaine"}</div>
        {logos[cur.id] && !brokenLogos.has(cur.id) ? (
          <Image
            src={logos[cur.id]}
            alt={cur.title}
            className={styles.titleLogo}
            width={440}
            height={96}
            onError={() => setBrokenLogos((prev) => new Set(prev).add(cur.id))}
          />
        ) : (
          <div className={styles.title}>
            <em>{words[0]}</em>{words.length > 1 ? " " + words.slice(1).join(" ") : ""}
          </div>
        )}
        <div className={styles.meta}>
          {cur.year && <span>{cur.year}</span>}
          {cur.year && genres.length > 0 && <span className={styles.sep} />}
          {genres.length > 0 && <span>{genres.join(" · ")}</span>}
          {cur.voteAverage > 0 && (
            <span className={styles.score}>
              <StarIcon /> <Rating value={cur.voteAverage} outOf />
            </span>
          )}
        </div>
        {cur.overview && <p className={styles.synopsis}>{cur.overview}</p>}
        <div className={styles.actions}>
          <Link href={`${detailBase}/${cur.id}`} className={styles.btnPrimary}>
            <ExternalIcon /> Voir la fiche
          </Link>
          <button
            className={styles.btnGhost}
            onClick={() => handleWatchlist(cur.id)}
            disabled={isPending}
            title={
              inWatchlist.has(cur.id)
                ? "Retirer de la watchlist"
                : "Ajouter à la watchlist"
            }
          >
            {inWatchlist.has(cur.id) ? (
              <>
                <CheckIcon /> Dans la watchlist
              </>
            ) : (
              <>
                <PlusIcon /> Watchlist
              </>
            )}
          </button>
        </div>
      </div>

      {cur.posterUrl && (
        <div className={styles.poster}>
          <Image
            src={cur.posterUrl}
            alt=""
            fill
            priority
            sizes="210px"
            style={{ objectFit: "cover" }}
          />
        </div>
      )}

      <div className={styles.rail}>
        {movies.map((m, i) => (
          <div
            key={m.id}
            className={`${styles.thumb} ${i === idx ? styles.thumbOn : ""}`}
            onClick={() => setIdx(i)}
          >
            {m.posterUrl && (
              <Image
                src={m.posterUrl}
                alt={m.title}
                fill
                sizes="52px"
                style={{ objectFit: "cover" }}
              />
            )}
          </div>
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
