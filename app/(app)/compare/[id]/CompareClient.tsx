"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Rating } from "@/lib/rating-scale";
import styles from "./compare.module.css";

export type CommonTitle = {
  tmdbId: number;
  title: string;
  posterUrl: string;
  year: string;
  mine: number;
  theirs: number;
};

type SortKey = "gap" | "agree" | "mine" | "theirs";

const SORTS: Array<{ key: SortKey; label: string }> = [
  { key: "gap", label: "Plus gros désaccords" },
  { key: "agree", label: "Plus d'accord" },
  { key: "mine", label: "Mes meilleures notes" },
  { key: "theirs", label: "Ses meilleures notes" },
];

export default function CompareClient({
  common,
  mediaBase,
}: {
  common: CommonTitle[];
  /** « /film » ou « /series » — base des liens vers les fiches. */
  mediaBase: string;
}) {
  const [sort, setSort] = useState<SortKey>("gap");

  const rows = useMemo(() => {
    const withGap = common.map((c) => ({ ...c, gap: c.mine - c.theirs }));
    switch (sort) {
      case "gap":
        return withGap.sort((a, b) => Math.abs(b.gap) - Math.abs(a.gap));
      case "agree":
        return withGap.sort(
          (a, b) => Math.abs(a.gap) - Math.abs(b.gap) || b.mine - a.mine,
        );
      case "mine":
        return withGap.sort((a, b) => b.mine - a.mine);
      case "theirs":
        return withGap.sort((a, b) => b.theirs - a.theirs);
    }
  }, [common, sort]);

  if (common.length === 0) {
    return (
      <div className={styles.empty}>
        Aucun titre noté en commun pour l&apos;instant.
      </div>
    );
  }

  return (
    <>
      <div className={styles.toolbar}>
        {SORTS.map((s) => (
          <button
            key={s.key}
            className={`${styles.sortBtn} ${sort === s.key ? styles.sortOn : ""}`}
            onClick={() => setSort(s.key)}
          >
            {s.label}
          </button>
        ))}
      </div>

      <div className={styles.rows}>
        {rows.map((r) => {
          const abs = Math.abs(r.gap);
          // Trois paliers : accord exact, nuance, vrai désaccord.
          const gapClass =
            abs === 0 ? styles.gapNone : abs > 2 ? styles.gapBig : styles.gapSmall;

          return (
            <Link key={r.tmdbId} href={`${mediaBase}/${r.tmdbId}`} className={styles.row}>
              <div className={styles.poster}>
                {r.posterUrl && (
                  <Image src={r.posterUrl} alt="" fill sizes="44px" style={{ objectFit: "cover" }} />
                )}
              </div>

              <div>
                <div className={styles.rowTitle}>{r.title}</div>
                {r.year && <div className={styles.rowYear}>{r.year}</div>}
              </div>

              <div className={styles.ratings}>
                <div className={styles.ratingCell}>
                  <div className={styles.ratingVal}>★ <Rating value={r.mine} /></div>
                  <div className={styles.ratingWho}>Vous</div>
                </div>
                <div className={`${styles.gap} ${gapClass}`}>
                  {abs === 0 ? "=" : `${r.gap > 0 ? "+" : "−"}${abs.toFixed(1).replace(/\.0$/, "")}`}
                </div>
                <div className={styles.ratingCell}>
                  <div className={styles.ratingVal}>★ <Rating value={r.theirs} /></div>
                  <div className={styles.ratingWho}>Lui/elle</div>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </>
  );
}
