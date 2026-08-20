"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import styles from "./actor.module.css";

const BackIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" width="14" height="14">
    <path d="m15 18-6-6 6-6" />
  </svg>
);

export default function ActorTopbar() {
  const router = useRouter();
  return (
    <div className={styles.topbar}>
      <button className={styles.backBtn} onClick={() => router.back()}>
        <BackIcon /> <span>Retour</span>
      </button>
      {/* Logo cliquable : retour à l'accueil films. */}
      <Link href="/films" className={styles.brand} aria-label="Retour à l'accueil">
        Movie<em>tracker</em>
      </Link>
    </div>
  );
}
