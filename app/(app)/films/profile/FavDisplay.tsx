import Link from "next/link";
import Image from "next/image";
import styles from "./profile.module.css";

export type FavDisplayItem = {
  position: number;
  href: string;
  title: string;
  posterUrl: string;
  year: string;
};

/**
 * Favoris d'un autre utilisateur, en lecture seule.
 *
 * Mêmes grille et cartes que `FavFilmsClient` sur son propre profil : la
 * grille générique des collections, utilisée auparavant, donnait des affiches
 * plus petites qui n'occupaient pas toute la largeur. Les emplacements vides
 * ne sont pas montrés, mais la grille garde ses 4 colonnes pour que les cartes
 * aient la même taille que chez soi.
 */
export default function FavDisplay({ items }: { items: FavDisplayItem[] }) {
  return (
    <div className={styles.favsGrid}>
      {items.map(({ position, href, title, posterUrl, year }) => (
        <Link key={position} href={href} className={`${styles.favSlot} ${styles.favSlotLink}`}>
          <div className={styles.favBg}>
            {posterUrl && (
              <Image
                src={posterUrl}
                alt=""
                fill
                sizes="(max-width: 768px) 50vw, 280px"
                style={{ objectFit: "cover" }}
              />
            )}
          </div>
          <div className={styles.favOverlay} />
          <div className={styles.favNum}>{position}</div>
          <div className={styles.favInfo}>
            <div className={styles.favTitle}>{title}</div>
            {year && <div className={styles.favMeta}>{year}</div>}
          </div>
        </Link>
      ))}
    </div>
  );
}
