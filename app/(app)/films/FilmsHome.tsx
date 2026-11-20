import { Suspense } from "react";
import BilanBanner, { bilanBannerYear } from "../components/BilanBanner";
import CollectionClient from "../components/CollectionClient";
import AddFilmButton from "../components/AddFilmButton";
import { getCollectionData, getHeroData, heroEmptyMessage, type HeroSource } from "./home-data";
import { statItems } from "../components/home/stats";
import { HomeHero } from "../components/home/HomeHero";
import styles from "../components/home/home.module.css";

/**
 * Accueil Films, direction Nocturne — « la salle s'éteint, l'image prend toute
 * la place ». Hero plein cadre aux coins arrondis sous l'en-tête global
 * (posé sur l'image grâce à `data-hero`), puis toute la collection en grille
 * à défilement infini, comme sur le profil.
 */

/** Source du carrousel dans l'URL ; Cinémas est la valeur par défaut. */
function sourceHref(source: HeroSource) {
  return source === "cinema" ? "/films" : `/films?source=${source}`;
}

async function HeroSection({ userId, source }: { userId: string; source: HeroSource }) {
  const data = await getHeroData(userId, source);
  const other = source === "cinema" ? "streaming" : "cinema";

  if (data.movies.length === 0) {
    return (
      <section className={`${styles.hero} ${styles.heroEmpty}`}>
        <p className={styles.emptyMsg}>{heroEmptyMessage(source)}</p>
      </section>
    );
  }

  return (
    <HomeHero
      movies={data.movies}
      logos={data.logos}
      watchlistIds={data.watchlistIds}
      sourceLabel={source === "cinema" ? "en salles" : "en streaming"}
      switchHref={sourceHref(other)}
      switchLabel={other === "cinema" ? "Cinémas" : "Streaming"}
    />
  );
}

async function CollectionSection({ userId }: { userId: string }) {
  const { films, total, stats } = await getCollectionData(userId);
  return (
    <>
      <div className={styles.collHead}>
        <h2 className={styles.h2}>Ma collection</h2>
        <span className={styles.spacer} />
        {stats &&
          statItems(stats).map((s) => (
            <div key={s.label} className={styles.statPill}>
              <span className={styles.statVal}>{s.value}</span>
              <span className={styles.statLab}>{s.label}</span>
              <span className={styles[`tone_${s.tone}`]}>{s.delta}</span>
            </div>
          ))}
        <AddFilmButton />
      </div>
      <CollectionClient films={films} total={total} showWatchlist />
    </>
  );
}

export default function FilmsHome({ userId, source }: { userId: string; source: HeroSource }) {
  const bilanYear = bilanBannerYear();
  return (
    <div className={styles.page} data-hero>
      <Suspense key={source} fallback={<section className={`${styles.hero} ${styles.heroSkeleton}`} />}>
        <HeroSection userId={userId} source={source} />
      </Suspense>

      <div className={styles.below}>
        {bilanYear !== null && <BilanBanner year={bilanYear} />}
        <Suspense fallback={<div className={`${styles.skeleton} skeletonBlock`} />}>
          <CollectionSection userId={userId} />
        </Suspense>
      </div>
    </div>
  );
}
