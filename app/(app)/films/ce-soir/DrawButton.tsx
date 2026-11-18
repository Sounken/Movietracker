"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Dices, X } from "lucide-react";
import styles from "./ce-soir.module.css";

type Candidate = { tmdbId: number; title: string; posterUrl: string; year: string };

/** Tire au sort parmi les films qui font le plus l'unanimité. */
export default function DrawButton({ candidates }: { candidates: Candidate[] }) {
  const [pick, setPick] = useState<Candidate | null>(null);

  useEffect(() => {
    if (!pick) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setPick(null);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [pick]);

  if (candidates.length === 0) return null;

  const draw = () => {
    // Un nouveau tirage évite de reproposer le même film quand c'est possible.
    const pool = candidates.length > 1 && pick ? candidates.filter((c) => c.tmdbId !== pick.tmdbId) : candidates;
    setPick(pool[Math.floor(Math.random() * pool.length)]);
  };

  return (
    <>
      <button type="button" className={styles.drawBtn} onClick={draw}>
        <Dices size={15} /> Tirer au sort
      </button>
      {pick && (
        <div className={styles.drawBackdrop} onClick={() => setPick(null)}>
          <div className={styles.drawCard} onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Film tiré au sort">
            <button type="button" className={styles.drawClose} onClick={() => setPick(null)} aria-label="Fermer">
              <X size={16} />
            </button>
            <div className={styles.drawLabel}>Ce soir, ce sera…</div>
            {pick.posterUrl && (
              <Image key={pick.tmdbId} src={pick.posterUrl} alt="" width={220} height={330} className={styles.drawPoster} />
            )}
            <div className={styles.drawTitle}>
              {pick.title} {pick.year && <span className={styles.drawYear}>({pick.year})</span>}
            </div>
            <div className={styles.drawActions}>
              <Link href={`/film/${pick.tmdbId}`} className={styles.drawPrimary}>
                Voir la fiche
              </Link>
              {candidates.length > 1 && (
                <button type="button" className={styles.drawSecondary} onClick={draw}>
                  Un autre
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
