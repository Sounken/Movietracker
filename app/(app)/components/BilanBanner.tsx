import Link from "next/link";
import { Sparkles } from "lucide-react";
import styles from "./BilanBanner.module.css";

/**
 * Bandeau d'accueil « votre bilan est prêt », de décembre à fin janvier.
 *
 * En décembre il annonce l'année en cours, en janvier celle qui vient de se
 * terminer. Le reste de l'année, le bilan reste accessible depuis le profil.
 */
export function bilanBannerYear(now: Date = new Date()): number | null {
  const month = now.getMonth();
  if (month === 11) return now.getFullYear();
  if (month === 0) return now.getFullYear() - 1;
  return null;
}

export default function BilanBanner({ year }: { year: number }) {
  const href = year === new Date().getUTCFullYear() ? "/films/bilan" : `/films/bilan?annee=${year}`;
  return (
    <Link href={href} className={styles.banner}>
      <Sparkles size={18} className={styles.icon} />
      <span className={styles.text}>
        <strong>Votre bilan {year} est prêt.</strong> Films, heures, préférés : votre année en un
        coup d&apos;œil, à partager.
      </span>
      <span className={styles.cta}>Voir</span>
    </Link>
  );
}
