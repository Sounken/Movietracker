"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { toggleWatchlist, toggleLiked } from "@/app/actions/film";
import { addFilmToList, removeFilmFromList } from "@/app/actions/lists";
import styles from "./PosterActions.module.css";

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
  initialWatchlist: boolean;
  initialLiked: boolean;
  userLists: UserList[];
  listsWithFilm: string[];
  isAuthenticated: boolean;
};

export default function PosterActions({
  tmdbId,
  initialWatchlist,
  initialLiked,
  userLists,
  listsWithFilm,
  isAuthenticated,
}: Props) {
  const router = useRouter();
  const requireAuth = () => { if (!isAuthenticated) { router.push("/login"); return false; } return true; };
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

  function toggleList(listId: string) {
    if (!requireAuth()) return;
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
      {/* La notation se fait directement dans le bloc « Votre note » à droite. */}

      {/* Watchlist */}
      <button
        className={watchlist ? styles.rated : ""}
        onClick={() => {
          if (!requireAuth()) return;
          startTransition(async () => {
            setWatchlist((v) => !v);
            await toggleWatchlist(tmdbId);
          });
        }}
      >
        <ClockIcon />
        {watchlist ? <>Dans ma watchlist <Check size={13} /></> : "Ajouter à la watchlist"}
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
        onClick={() => {
          if (!requireAuth()) return;
          startTransition(async () => {
            setLiked((v) => !v);
            await toggleLiked(tmdbId);
          });
        }}
      >
        <HeartIcon />
        {liked ? <>Dans vos favoris <Check size={13} /></> : "Ajouter aux favoris"}
      </button>
    </div>
  );
}
