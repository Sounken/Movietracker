import { Suspense } from "react";
import { fetchAwards } from "@/lib/awards";
import AwardsSection from "./AwardsSection";
import styles from "./AwardsSection.module.css";

/**
 * Distinctions Wikidata, sorties du chemin critique.
 *
 * L'appel était attendu avant le premier rendu de la fiche. Or il en fait deux
 * à lui seul — `Special:EntityData` puis `wbgetentities` — et Wikidata est lent
 * : mesuré entre 0,6 et 2,7 secondes selon le film, médiane ~1,2 s. C'était le
 * poste le plus lourd de la page, très loin devant le lot des neuf appels TMDB
 * qui partent ensemble en ~0,3 s.
 *
 * Le pire : `AwardsSection` ne rend rien quand la liste est vide. Pour environ
 * un film sur quatre (Le Prestige, Les Goonies, Le Tombeau des Lucioles dans
 * notre échantillon), on faisait donc patienter une seconde pour n'afficher
 * strictement rien.
 *
 * La fiche s'affiche désormais sans attendre, un squelette occupe la place, et
 * le bloc arrive quand Wikidata répond.
 */

type Placement = {
  /** Classes de la fiche hôte, pour que le bloc s'y fonde. */
  sectionClassName: string;
  titleClassName: string;
};

async function AwardsContent({
  wikidataId,
  sectionClassName,
  titleClassName,
}: Placement & { wikidataId: string }) {
  const awards = await fetchAwards(wikidataId);
  return (
    <AwardsSection
      awards={awards}
      sectionClassName={sectionClassName}
      titleClassName={titleClassName}
    />
  );
}

/**
 * Trois pastilles de largeurs inégales, à la hauteur exacte des vraies : la
 * section ne saute pas quand le contenu arrive. Elle disparaît en revanche si
 * le film n'a aucune distinction — c'est le prix à payer pour ne plus bloquer
 * le rendu, et ça reste préférable à une seconde d'attente pour rien.
 */
function AwardsSkeleton({ sectionClassName, titleClassName }: Placement) {
  return (
    <div className={sectionClassName}>
      <div className={titleClassName}>Distinctions</div>
      <div className={styles.list} aria-hidden="true">
        {[132, 96, 158].map((width) => (
          <span key={width} className={`${styles.skelPill} skeletonBlock`} style={{ width }} />
        ))}
      </div>
    </div>
  );
}

export default function AwardsAsync({
  wikidataId,
  sectionClassName,
  titleClassName,
}: Placement & { wikidataId: string | null }) {
  // Sans identifiant Wikidata, il n'y a rien à attendre ni à afficher.
  if (!wikidataId) return null;

  return (
    <Suspense fallback={<AwardsSkeleton sectionClassName={sectionClassName} titleClassName={titleClassName} />}>
      <AwardsContent
        wikidataId={wikidataId}
        sectionClassName={sectionClassName}
        titleClassName={titleClassName}
      />
    </Suspense>
  );
}
