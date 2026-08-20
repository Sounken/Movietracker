"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Star, Clock, Heart, Check } from "lucide-react";
import { saveSeriesRating, toggleSeriesWatchlist, toggleSeriesLiked } from "@/app/actions/series";
import { useRatingScale } from "@/lib/rating-scale";
import { toDisplayRating, toStoredRating, formatRating } from "@/lib/rating";
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
  const scale = useRatingScale();
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
      {/* mouseleave sur le conteneur : sortir de la rangée réaffiche
          systématiquement la note enregistrée (cf. RatingWidget). */}
      <div className={styles.stars} onMouseLeave={() => setHover(0)}>
        {Array.from({ length: 10 }, (_, i) => i + 1).map((v) => (
          <button
            key={v}
            className={styles.star}
            onMouseEnter={() => setHover(v)}
            onClick={() => { setHover(0); saveRating(v); }}
            aria-label={`Noter ${toDisplayRating(v, scale)}/${scale}`}
          >
            <Star
              size={18}
              fill={(hover || rating) >= v ? "currentColor" : "none"}
              className={(hover || rating) >= v ? styles.starOn : styles.starOff}
            />
          </button>
        ))}
        {scale === 100 ? (
          <span className={styles.ratingVal}>
            <input
              type="number"
              className={styles.ratingInput}
              min={0}
              max={100}
              step={1}
              aria-label="Note sur 100"
              placeholder="—"
              value={rating > 0 ? String(toDisplayRating(rating, 100)) : ""}
              onChange={(e) => {
                const raw = e.target.value;
                if (raw === "") return;
                const n = Number(raw);
                if (Number.isNaN(n)) return;
                setRating(toStoredRating(Math.min(100, Math.max(0, n)), 100));
              }}
              onBlur={() => { if (rating > 0) saveRating(rating); }}
              onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
            />
            /100
          </span>
        ) : (
          <span className={styles.ratingVal}>{rating > 0 ? `${formatRating(rating, scale)}/10` : ""}</span>
        )}
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
