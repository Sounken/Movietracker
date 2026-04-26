"use client";

import { useState } from "react";
import Link from "next/link";
import type { TmdbCastMember } from "@/lib/tmdb";
import styles from "../film.module.css";

function castColor(name: string) {
  const hues = [18, 200, 280, 140, 30, 340, 60, 220];
  return `hsl(${hues[name.charCodeAt(0) % hues.length]}, 35%, 28%)`;
}

const PlusIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="32" height="32" strokeLinecap="round">
    <path d="M12 5v14M5 12h14" />
  </svg>
);
const MinusIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="32" height="32" strokeLinecap="round">
    <path d="M5 12h14" />
  </svg>
);

const INITIAL_COUNT = 8;

export default function CastGrid({ cast }: { cast: TmdbCastMember[] }) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? cast : cast.slice(0, INITIAL_COUNT);
  const remaining = cast.length - INITIAL_COUNT;

  return (
    <div className={styles.section}>
      <div className={styles.sectionTitle}>Casting</div>
      <div className={styles.castGrid}>
        {visible.map((c) => (
          <Link key={c.id} href={`/actor/${c.id}`} className={styles.castCard}>
            {c.profileUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={c.profileUrl} alt={c.name} className={styles.castPhoto} />
            ) : (
              <div className={styles.castAvatar} style={{ background: castColor(c.name) }}>
                {c.name.split(" ").map((w) => w[0]).join("").slice(0, 2)}
              </div>
            )}
            <div className={styles.castInfo}>
              <div className={styles.castName}>{c.name}</div>
              <div className={styles.castRole}>{c.character}</div>
            </div>
          </Link>
        ))}

        {/* Load more / collapse card — same grid slot as cast cards */}
        {remaining > 0 && (
          <button
            className={`${styles.castCard} ${styles.castMoreCard}`}
            onClick={() => setExpanded((v) => !v)}
          >
            <div className={styles.castMorePoster}>
              {expanded ? <MinusIcon /> : <PlusIcon />}
            </div>
            <div className={styles.castInfo}>
              <div className={styles.castName} style={{ textAlign: "center" }}>
                {expanded ? "Réduire" : `${remaining} de plus`}
              </div>
            </div>
          </button>
        )}
      </div>
    </div>
  );
}
