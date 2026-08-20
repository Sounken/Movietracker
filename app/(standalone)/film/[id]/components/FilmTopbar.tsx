"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import SearchBox from "@/app/(app)/components/SearchBox";
import styles from "./FilmTopbar.module.css";

const BackIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" width="14" height="14">
    <path d="m15 18-6-6 6-6" />
  </svg>
);

/**
 * `fallbackHref` : destination quand il n'y a pas d'historique (fiche ouverte
 * en direct, lien partagé, PWA). La fiche série passe `/series`, la fiche film
 * `/films` — auparavant le lien pointait en dur sur `/`, qui redirige vers
 * `/films` : depuis une série on retombait donc toujours sur les films.
 */
export default function FilmTopbar({ fallbackHref = "/films" }: { fallbackHref?: string }) {
  const router = useRouter();

  // Décidé au clic (et non au montage) : pas d'état à synchroniser, et
  // l'historique est lu au moment où il compte vraiment.
  const goBack = () => {
    // history.length === 1 → onglet ouvert directement sur cette fiche.
    if (window.history.length > 1) router.back();
    else router.push(fallbackHref);
  };

  return (
    <div className={styles.topbar}>
      <button type="button" className={styles.backBtn} onClick={goBack}>
        <BackIcon /> <span>Retour</span>
      </button>
      {/* Le logo ramène à l'accueil du monde courant (films ou séries). */}
      <Link href={fallbackHref} className={styles.brand} aria-label="Retour à l'accueil">
        Movie<em>tracker</em>
      </Link>
      {/* Même recherche que l'accueil, calée à droite de la barre. */}
      <div className={styles.searchSlot}>
        <SearchBox compact placeholder="Chercher un film, une série…" />
      </div>
    </div>
  );
}
