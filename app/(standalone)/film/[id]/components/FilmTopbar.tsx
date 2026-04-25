"use client";

import Link from "next/link";
import styles from "./FilmTopbar.module.css";

const BackIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" width="14" height="14">
    <path d="m15 18-6-6 6-6" />
  </svg>
);

export default function FilmTopbar() {
  return (
    <div className={styles.topbar}>
      <Link href="/" className={styles.backBtn}>
        <BackIcon /> <span>Retour</span>
      </Link>
      <div className={styles.brand}>
        Movie<em>tracker</em>
      </div>
    </div>
  );
}
