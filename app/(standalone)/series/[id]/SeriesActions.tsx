"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Star, Clock, Heart, Check } from "lucide-react";
import { saveSeriesRating, toggleSeriesWatchlist, toggleSeriesLiked } from "@/app/actions/series";
import styles from "./series.module.css";

export default function SeriesActions({
  tmdbId,
  initialRating,
  initialReview,
  initialWatchlist,
  initialLiked,
  isAuthenticated,
}: {
  tmdbId: number;
  initialRating: number;
  initialReview: string;
  initialWatchlist: boolean;
  initialLiked: boolean;
  isAuthenticated: boolean;
}) {
  const router = useRouter();
  const [rating, setRating] = useState(initialRating);
  const [hover, setHover] = useState(0);
  const [review, setReview] = useState(initialReview);
  const [watchlist, setWatchlist] = useState(initialWatchlist);
  const [liked, setLiked] = useState(initialLiked);
  const [saved, setSaved] = useState(false);
  const [, startTransition] = useTransition();

  function requireAuth(): boolean {
    if (!isAuthenticated) {
      router.push("/login");
      return false;
    }
    return true;
  }

  function saveRating(value: number) {
    if (!requireAuth()) return;
    setRating(value);
    startTransition(async () => {
      try {
        await saveSeriesRating(tmdbId, value, review);
        setSaved(true);
        setTimeout(() => setSaved(false), 1500);
      } catch {
        router.refresh();
      }
    });
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

  function onSaveReview() {
    if (!requireAuth()) return;
    startTransition(async () => {
      try {
        await saveSeriesRating(tmdbId, rating, review);
        setSaved(true);
        setTimeout(() => setSaved(false), 1500);
      } catch {
        router.refresh();
      }
    });
  }

  return (
    <div className={styles.actions}>
      <div className={styles.stars}>
        {Array.from({ length: 10 }, (_, i) => i + 1).map((v) => (
          <button
            key={v}
            className={styles.star}
            onMouseEnter={() => setHover(v)}
            onMouseLeave={() => setHover(0)}
            onClick={() => saveRating(v)}
            aria-label={`Noter ${v}/10`}
          >
            <Star
              size={18}
              fill={(hover || rating) >= v ? "currentColor" : "none"}
              className={(hover || rating) >= v ? styles.starOn : styles.starOff}
            />
          </button>
        ))}
        <span className={styles.ratingVal}>{rating > 0 ? `${rating}/10` : ""}</span>
      </div>

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

      <textarea
        className={styles.review}
        placeholder="Votre avis sur la série…"
        value={review}
        onChange={(e) => setReview(e.target.value)}
      />
      <button className={styles.saveReview} onClick={onSaveReview}>
        {saved ? "✓ Enregistré" : "Enregistrer l'avis"}
      </button>
    </div>
  );
}
