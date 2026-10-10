import Image from "next/image";
import type { WatchProviders } from "@/lib/tmdb";
import styles from "./WatchProvidersSection.module.css";

// L'achat définitif est écarté : presque personne n'achète un film en
// numérique pour le regarder ce soir, et ce groupe doublait souvent la
// location avec les mêmes plateformes.
const GROUPS = [
  { key: "flatrate", label: "En abonnement" },
  { key: "rent", label: "En location" },
] as const;

/**
 * Où regarder le titre en France.
 *
 * Ces données viennent de JustWatch via TMDB ; leurs conditions d'utilisation
 * imposent d'attribuer la source et de renvoyer vers leur page — d'où le lien
 * en pied de bloc, qui n'est pas décoratif.
 */
export default function WatchProvidersSection({
  providers,
  sectionClassName,
  titleClassName,
  compact = false,
}: {
  providers: WatchProviders;
  /** Classes de la fiche hôte, pour que le bloc s'y fonde. */
  sectionClassName: string;
  titleClassName: string;
  /**
   * Logos seuls, le nom au survol : sous l'affiche, la colonne fait 280 px et
   * des pastilles nommées y passeraient une par ligne.
   */
  compact?: boolean;
}) {
  const groups = GROUPS.map((g) => ({ ...g, items: providers[g.key] })).filter(
    (g) => g.items.length > 0,
  );

  if (groups.length === 0) return null;

  return (
    <div className={`${sectionClassName} ${compact ? styles.compact : ""}`}>
      <div className={titleClassName}>Où regarder</div>

      {groups.map((group) => (
        <div key={group.key} className={styles.group}>
          <div className={styles.groupLabel}>{group.label}</div>
          <div className={styles.providers}>
            {group.items.map((p) => (
              <a
                key={p.id}
                href={providers.link}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.provider}
                title={p.name}
              >
                {p.logoUrl ? (
                  <Image src={p.logoUrl} alt={p.name} width={44} height={44} className={styles.logo} />
                ) : (
                  <span className={styles.fallback}>{p.name.slice(0, 2)}</span>
                )}
                <span className={styles.name}>{p.name}</span>
              </a>
            ))}
          </div>
        </div>
      ))}

      <div className={styles.attribution}>
        Disponibilités fournies par{" "}
        <a href={providers.link} target="_blank" rel="noopener noreferrer">
          JustWatch
        </a>
      </div>
    </div>
  );
}
