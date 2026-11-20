import styles from "./loading.module.css";

/**
 * Attente des fiches détaillées (film, série, acteur, société).
 *
 * Ces pages enchaînent plusieurs appels TMDB : sans écran intermédiaire, le
 * clic sur « voir la fiche » laissait l'écran précédent figé pendant une
 * seconde. Le squelette reprend le gabarit Nocturne : hero arrondi sous
 * l'en-tête, colonne de l'affiche qui le chevauche.
 */
export default function StandaloneLoading() {
  return (
    <div className={styles.page} data-hero aria-busy="true" aria-label="Chargement de la fiche">
      <div className={`skeletonBlock ${styles.hero}`} />
      <div className={styles.body}>
        <div className={styles.side}>
          <div className={`skeletonBlock ${styles.poster}`} />
          <div className={`skeletonBlock ${styles.card}`} />
        </div>
        <div className={styles.main}>
          <div className={`skeletonBlock ${styles.tabs}`} />
          <div className={`skeletonBlock ${styles.line}`} />
          <div className={`skeletonBlock ${styles.line}`} />
          <div className={`skeletonBlock ${styles.lineShort}`} />
        </div>
      </div>
    </div>
  );
}
