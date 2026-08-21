import styles from "./loading.module.css";

/**
 * Écran d'attente commun aux pages du groupe « app ».
 *
 * Il reprend la silhouette réelle des pages (en-tête, bandeau de statistiques,
 * grille d'affiches) plutôt qu'un spinner centré : la mise en page ne saute pas
 * quand les vraies données arrivent.
 */
export default function AppLoading() {
  return (
    <div className={styles.wrap} aria-busy="true" aria-label="Chargement">
      <div className={styles.head}>
        <div className={`skeletonBlock ${styles.sub}`} />
        <div className={`skeletonBlock ${styles.title}`} />
      </div>

      <div className={styles.stats}>
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className={`skeletonBlock ${styles.stat}`} />
        ))}
      </div>

      <div className={styles.grid}>
        {Array.from({ length: 12 }, (_, i) => (
          <div key={i} className={`skeletonBlock ${styles.card}`} />
        ))}
      </div>
    </div>
  );
}
