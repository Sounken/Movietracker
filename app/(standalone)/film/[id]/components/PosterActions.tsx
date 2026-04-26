"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import { toggleWatchlist, toggleLiked } from "@/app/actions/film";
import { addFilmToList, removeFilmFromList } from "@/app/actions/lists";
import styles from "./PosterActions.module.css";

const CLEAR_RATING_REQUEST_EVENT = "movietracker:clear-rating-request";
const RATING_CLEARED_EVENT = "movietracker:rating-cleared";
const RATING_CHANGED_EVENT = "movietracker:rating-changed";

const StarIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" width="15" height="15">
    <path d="m12 2 3 7 7 .5-5.5 4.5L18 22l-6-4-6 4 1.5-8L2 9.5 9 9z" />
  </svg>
);
const ClockIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" width="15" height="15">
    <circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" />
  </svg>
);
const ListPlusIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" width="15" height="15">
    <path d="M8 6h13M8 12h13M8 18h7M3 6h.01M3 12h.01M3 18h.01M18 15v6M15 18h6" />
  </svg>
);
const HeartIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" width="15" height="15">
    <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 1 0-7.8 7.8l1 1L12 21.2l7.8-7.8 1-1a5.5 5.5 0 0 0 0-7.8z" />
  </svg>
);
const CheckIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" width="13" height="13">
    <path d="M5 13l4 4L19 7" />
  </svg>
);

type UserList = { id: string; name: string; emoji: string };

type Props = {
  tmdbId: number;
  initialRating: number;
  initialWatchlist: boolean;
  initialLiked: boolean;
  userLists: UserList[];
  listsWithFilm: string[];
};

export default function PosterActions({
  tmdbId,
  initialRating,
  initialWatchlist,
  initialLiked,
  userLists,
  listsWithFilm,
}: Props) {
  const [rating, setRating] = useState(initialRating);
  const [watchlist, setWatchlist] = useState(initialWatchlist);
  const [liked, setLiked] = useState(initialLiked);
  const [listMembership, setListMembership] = useState<Set<string>>(new Set(listsWithFilm));
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [, startTransition] = useTransition();
  const dropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!dropRef.current?.contains(e.target as Node)) setDropdownOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<{ tmdbId: number }>).detail;
      if (detail?.tmdbId === tmdbId) setRating(0);
    };
    window.addEventListener(RATING_CLEARED_EVENT, handler);
    return () => window.removeEventListener(RATING_CLEARED_EVENT, handler);
  }, [tmdbId]);

  useEffect(() => {
    setRating(initialRating);
  }, [initialRating]);

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<{ tmdbId: number; rating: number }>).detail;
      if (detail?.tmdbId === tmdbId) setRating(detail.rating);
    };
    window.addEventListener(RATING_CHANGED_EVENT, handler);
    return () => window.removeEventListener(RATING_CHANGED_EVENT, handler);
  }, [tmdbId]);

  function handleRatingAction() {
    if (rating <= 0) {
      document.getElementById("rating-widget")?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
      return;
    }

    window.dispatchEvent(new CustomEvent(CLEAR_RATING_REQUEST_EVENT, { detail: { tmdbId } }));
  }

  function toggleList(listId: string) {
    const isIn = listMembership.has(listId);
    setListMembership((prev) => {
      const next = new Set(prev);
      if (isIn) next.delete(listId); else next.add(listId);
      return next;
    });
    startTransition(async () => {
      if (isIn) await removeFilmFromList(listId, tmdbId);
      else await addFilmToList(listId, tmdbId);
    });
  }

  return (
    <div className={styles.actions}>
      {/* Rating (scroll to widget) */}
      <button
        className={rating > 0 ? styles.rated : ""}
        onClick={handleRatingAction}
      >
        <StarIcon />
        {rating > 0 ? `Supprimer ma note (${rating}/10)` : "Noter ce film"}
      </button>

      {/* Watchlist */}
      <button
        className={watchlist ? styles.rated : ""}
        onClick={() =>
          startTransition(async () => {
            setWatchlist((v) => !v);
            await toggleWatchlist(tmdbId);
          })
        }
      >
        <ClockIcon />
        {watchlist ? "Dans ma watchlist ✓" : "Ajouter à la watchlist"}
      </button>

      {/* Add to list dropdown */}
      <div className={styles.listWrap} ref={dropRef}>
        <button
          className={listMembership.size > 0 ? styles.rated : ""}
          onClick={() => setDropdownOpen((v) => !v)}
        >
          <ListPlusIcon />
          {listMembership.size > 0
            ? `Dans ${listMembership.size} liste${listMembership.size > 1 ? "s" : ""}`
            : "Ajouter à une liste"}
        </button>
        {dropdownOpen && (
          <div className={styles.dropdown}>
            {userLists.length === 0 ? (
              <div className={styles.dropEmpty}>Aucune liste créée.</div>
            ) : (
              userLists.map((list) => {
                const inList = listMembership.has(list.id);
                return (
                  <button
                    key={list.id}
                    className={`${styles.dropItem} ${inList ? styles.dropItemOn : ""}`}
                    onClick={() => toggleList(list.id)}
                  >
                    <span className={styles.dropEmoji}>{list.emoji}</span>
                    <span className={styles.dropName}>{list.name}</span>
                    {inList && <CheckIcon />}
                  </button>
                );
              })
            )}
          </div>
        )}
      </div>

      {/* Liked */}
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
        {liked ? "Dans vos favoris ✓" : "Ajouter aux favoris"}
      </button>
    </div>
  );
}
