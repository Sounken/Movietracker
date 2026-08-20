"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Clock, Heart, Check } from "lucide-react";
import { toggleSeriesWatchlist, toggleSeriesLiked } from "@/app/actions/series";
import styles from "./series.module.css";

/**
 * Actions sous le poster. La note et l'avis ont rejoint le bloc « Votre note »
 * de la colonne principale (composant RatingWidget partagé avec les films) :
 * les étoiles y gèrent les demi-points et affichent la note, ce que la rangée
 * lucide-react d'ici ne savait pas faire.
 */
export default function SeriesActions({
  tmdbId,
  initialWatchlist,
  initialLiked,
  isAuthenticated,
}: {
  tmdbId: number;
  initialWatchlist: boolean;
  initialLiked: boolean;
  isAuthenticated: boolean;
}) {
  const router = useRouter();
  const [watchlist, setWatchlist] = useState(initialWatchlist);
  const [liked, setLiked] = useState(initialLiked);
  const [, startTransition] = useTransition();

  function requireAuth(): boolean {
    if (!isAuthenticated) {
      router.push("/login");
      return false;
    }
    return true;
  }

  function onWatchlist() {
    if (!requireAuth()) return;
    setWatchlist((v) => !v);
    startTransition(async () => {
      try {
        await toggleSeriesWatchlist(tmdbId);
      } catch {
        setWatchlist((v) => !v);
      }
    });
  }

  function onLike() {
    if (!requireAuth()) return;
    setLiked((v) => !v);
    startTransition(async () => {
      try {
        await toggleSeriesLiked(tmdbId);
      } catch {
        setLiked((v) => !v);
      }
    });
  }

  return (
    <div className={styles.actions}>
      <div className={styles.actionRow}>
        <button
          className={`${styles.actionBtn} ${watchlist ? styles.actionOn : ""}`}
          onClick={onWatchlist}
        >
          {watchlist ? <Check size={15} /> : <Clock size={15} />}
          {watchlist ? "Dans la watchlist" : "Watchlist"}
        </button>
        <button
          className={`${styles.actionBtn} ${liked ? styles.actionLiked : ""}`}
          onClick={onLike}
        >
          <Heart size={15} fill={liked ? "currentColor" : "none"} />
          {liked ? "Aimée" : "J'aime"}
        </button>
      </div>
    </div>
  );
}
