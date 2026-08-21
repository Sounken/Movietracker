"use client";

import { useState } from "react";
import type { TmdbEpisode } from "@/lib/tmdb";
import { Rating } from "@/lib/rating-scale";
import styles from "./episodeChart.module.css";

/**
 * En dessous de ce nombre de votes, la note TMDB d'un épisode ne veut rien
 * dire (un 10/10 sur 4 votes). On l'affiche quand même, mais en sourdine, pour
 * ne pas laisser croire à un pic de qualité.
 */
const WEAK_VOTES = 30;

/**
 * Couleur de la barre selon la note, façon carte de chaleur.
 * Les paliers sont volontairement larges : l'œil doit distinguer « bon » de
 * « excellent » sans avoir à lire le chiffre.
 */
function toneOf(rating: number): string {
  if (rating >= 9) return styles.tier5;
  if (rating >= 8.2) return styles.tier4;
  if (rating >= 7.4) return styles.tier3;
  if (rating >= 6.5) return styles.tier2;
  return styles.tier1;
}

export default function EpisodeRatingChart({
  episodes,
  seasonNumber,
}: {
  episodes: TmdbEpisode[];
  seasonNumber: number;
}) {
  // Épisode survolé/sélectionné, pour la légende sous le graphique.
  const [focused, setFocused] = useState<number | null>(null);

  // Un épisode non diffusé n'a pas encore de note : il n'a rien à faire dans
  // la courbe, il y creuserait un trou à zéro.
  const rated = episodes.filter((e) => e.voteAverage > 0);
  if (rated.length < 2) return null;

  const values = rated.map((e) => e.voteAverage);
  const max = Math.max(...values);
  const min = Math.min(...values);

  // Échelle relative à la série, pas de 0 à 10 : sur une série où tout se joue
  // entre 7,8 et 9,2, une échelle absolue donnerait des barres toutes égales.
  // On garde un point de marge pour que la plus basse reste visible.
  const floor = Math.max(0, min - 0.4);
  const ceil = Math.min(10, max + 0.2);
  const span = ceil - floor || 1;

  const best = rated.reduce((a, b) => (b.voteAverage > a.voteAverage ? b : a));
  const worst = rated.reduce((a, b) => (b.voteAverage < a.voteAverage ? b : a));
  const average = values.reduce((s, v) => s + v, 0) / values.length;

  const current = focused !== null ? rated.find((e) => e.episodeNumber === focused) : null;

  return (
    <div className={styles.wrap}>
      <div className={styles.head}>
        <span className={styles.title}>Notes des épisodes</span>
        <span className={styles.avg}>
          Moyenne saison · ★ <Rating value={Math.round(average * 10) / 10} />
        </span>
      </div>

      <div className={styles.chart} onMouseLeave={() => setFocused(null)}>
        {rated.map((ep) => {
          const height = ((ep.voteAverage - floor) / span) * 100;
          const weak = ep.voteCount < WEAK_VOTES;
          const isFinale = ep.episodeType === "finale" || ep.episodeType === "mid_season";

          return (
            <button
              key={ep.episodeNumber}
              type="button"
              className={`${styles.col} ${focused === ep.episodeNumber ? styles.colOn : ""}`}
              onMouseEnter={() => setFocused(ep.episodeNumber)}
              onFocus={() => setFocused(ep.episodeNumber)}
              onClick={() => setFocused(ep.episodeNumber)}
              aria-label={`Épisode ${ep.episodeNumber} — ${ep.name} — ${ep.voteAverage}/10`}
            >
              <span
                className={`${styles.bar} ${toneOf(ep.voteAverage)} ${weak ? styles.barWeak : ""}`}
                style={{ height: `${Math.max(6, height)}%` }}
              />
              {/* Le point marque les finales de saison / mi-saison */}
              {isFinale && <span className={styles.finaleDot} aria-hidden="true" />}
              <span className={styles.num}>{ep.episodeNumber}</span>
            </button>
          );
        })}
      </div>

      {/* Zone de légende à hauteur fixe : sans elle, le survol ferait sauter
          tout ce qui suit le graphique. */}
      <div className={styles.readout}>
        {current ? (
          <>
            <span className={styles.readoutNum}>
              S{seasonNumber}E{current.episodeNumber}
            </span>
            <span className={styles.readoutName}>{current.name}</span>
            <span className={styles.readoutScore}>
              ★ <Rating value={current.voteAverage} />
              <span className={styles.readoutVotes}>
                {current.voteCount} vote{current.voteCount > 1 ? "s" : ""}
              </span>
            </span>
          </>
        ) : (
          <span className={styles.hint}>
            Meilleur : <strong>É{best.episodeNumber}</strong> (<Rating value={best.voteAverage} />)
            {" · "}
            Plus faible : <strong>É{worst.episodeNumber}</strong> (<Rating value={worst.voteAverage} />)
          </span>
        )}
      </div>
    </div>
  );
}
