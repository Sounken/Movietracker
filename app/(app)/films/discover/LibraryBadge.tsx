"use client";

import { useMemo } from "react";
import { Eye, Clock } from "lucide-react";
import type { LibraryStatus } from "@/lib/library-status";
import styles from "./discover.module.css";

/** Index des statuts, pour un test en O(1) par carte. */
export function useLibraryLookup(status: LibraryStatus | undefined) {
  return useMemo(() => {
    const watched = new Set(status?.watched);
    const watchlist = new Set(status?.watchlist);
    return (id: number) =>
      watched.has(id) ? "watched" : watchlist.has(id) ? "watchlist" : null;
  }, [status]);
}

/**
 * Pastille en haut à gauche de l'affiche (la note TMDB occupe la droite).
 * Icône + mot court : l'icône seule ne se comprend pas sur mobile, où le
 * `title` au survol n'existe pas. Horloge = watchlist, comme sur la fiche.
 */
export default function LibraryBadge({ kind }: { kind: "watched" | "watchlist" | null }) {
  if (!kind) return null;
  const watched = kind === "watched";
  return (
    <div
      className={`${styles.libraryBadge} ${watched ? styles.libraryWatched : ""}`}
      title={watched ? "Déjà vu" : "Dans ma watchlist"}
    >
      {watched ? <Eye size={12} strokeWidth={2} /> : <Clock size={12} strokeWidth={2} />}
      {watched ? "Vu" : "À voir"}
    </div>
  );
}
