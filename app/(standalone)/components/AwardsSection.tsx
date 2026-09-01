import { Trophy } from "lucide-react";
import type { Award } from "@/lib/awards";
import styles from "./AwardsSection.module.css";

/** Au-delà, la liste noie la fiche — les prix mineurs sont repliés. */
const VISIBLE = 8;

export default function AwardsSection({
  awards,
  sectionClassName,
  titleClassName,
}: {
  awards: Award[];
  /** Classes de la fiche hôte, pour que le bloc s'y fonde. */
  sectionClassName: string;
  titleClassName: string;
}) {
  if (awards.length === 0) return null;

  const shown = awards.slice(0, VISIBLE);
  const hidden = awards.length - shown.length;
  const majorCount = awards.filter((a) => a.major).length;

  return (
    <div className={sectionClassName}>
      <div className={titleClassName}>Distinctions</div>

      <div className={styles.list}>
        {shown.map((a) => (
          <span key={a.id} className={`${styles.award} ${a.major ? styles.major : ""}`}>
            {a.major && <Trophy size={11} className={styles.icon} />}
            {a.label}
            {a.year && <span className={styles.year}>{a.year}</span>}
          </span>
        ))}
      </div>

      <div className={styles.foot}>
        {hidden > 0 && <span>+ {hidden} autre{hidden > 1 ? "s" : ""} distinction{hidden > 1 ? "s" : ""}</span>}
        {majorCount > 0 && hidden > 0 && <span className={styles.sep}>•</span>}
        {/* Wikidata est sous licence CC0, mais citer la source reste correct
            — et permet de savoir d'où vient une donnée fausse. */}
        <span className={styles.source}>Source : Wikidata</span>
      </div>
    </div>
  );
}
