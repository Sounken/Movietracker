import styles from "./loading.module.css";

/**
 * Attente des fiches détaillées (film, série, acteur, société).
 *
 * Ces pages enchaînent plusieurs appels TMDB : sans écran intermédiaire, le
 * clic sur « voir la fiche » laissait l'écran précédent figé pendant une
 * seconde. Le squelette reprend la structure poster + colonne de métadonnées.
 */
export default function StandaloneLoading() {
  return (
    <div className={styles.hero} aria-busy="true" aria-label="Chargement de la fiche">
      <div className={styles.posterCol}>
        <div className={`skeletonBlock ${styles.poster}`} />
        <div className={`skeletonBlock ${styles.action}`} />
        <div className={`skeletonBlock ${styles.action}`} />
      </div>

      <div className={styles.metaCol}>
        <div className={styles.tags}>
          <div className={`skeletonBlock ${styles.tag}`} />
          <div className={`skeletonBlock ${styles.tag}`} />
        </div>
        <div className={`skeletonBlock ${styles.title}`} />

        <div className={styles.scores}>
          {Array.from({ length: 5 }, (_, i) => (
            <div key={i} className={`skeletonBlock ${styles.score}`} />
          ))}
        </div>

        <div className={`skeletonBlock ${styles.widget}`} />
        <div className={`skeletonBlock ${styles.line}`} />
        <div className={`skeletonBlock ${styles.line}`} />
        <div className={`skeletonBlock ${styles.lineShort}`} />
      </div>
    </div>
  );
}
