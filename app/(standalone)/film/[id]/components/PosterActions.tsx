"use client";

import { useState, useTransition } from "react";
import { toggleWatchlist, toggleLiked } from "@/app/actions/film";
import styles from "./PosterActions.module.css";

const StarIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" width="15" height="15">
    <path d="m12 2 3 7 7 .5-5.5 4.5L18 22l-6-4-6 4 1.5-8L2 9.5 9 9z" />
  </svg>
);
const ListIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" width="15" height="15">
    <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
  </svg>
);
const HeartIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" width="15" height="15">
    <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 1 0-7.8 7.8l1 1L12 21.2l7.8-7.8 1-1a5.5 5.5 0 0 0 0-7.8z" />
  </svg>
);

type Props = {
  tmdbId: number;
  initialRating: number;
  initialWatchlist: boolean;
  initialLiked: boolean;
};

export default function PosterActions({ tmdbId, initialRating, initialWatchlist, initialLiked }: Props) {
  const [watchlist, setWatchlist] = useState(initialWatchlist);
  const [liked, setLiked] = useState(initialLiked);
  const [, startTransition] = useTransition();

  return (
    <div className={styles.actions}>
      <button className={initialRating > 0 ? styles.rated : ""}>
        <StarIcon />
        {initialRating > 0 ? `Ma note : ${initialRating}/10` : "Noter ce film"}
      </button>
      <button
        className={watchlist ? styles.rated : ""}
        onClick={() =>
          startTransition(async () => {
            setWatchlist((v) => !v);
            await toggleWatchlist(tmdbId);
          })
        }
      >
        <ListIcon />
        {watchlist ? "Dans ma liste" : "Ajouter à une liste"}
      </button>
      <button
        className={liked ? styles.rated : ""}
        onClick={() =>
          startTransition(async () => {
            setLiked((v) => !v);
            await toggleLiked(tmdbId);
          })
        }
      >
        <HeartIcon />
        {liked ? "Dans vos favoris" : "Ajouter aux favoris"}
      </button>
    </div>
  );
}
