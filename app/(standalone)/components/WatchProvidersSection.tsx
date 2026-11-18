import Image from "next/image";
import type { WatchProviders } from "@/lib/tmdb";
import { canonicalProvider } from "@/lib/tmdb-catalog";
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
  mine = [],
  sectionClassName,
  titleClassName,
  compact = false,
}: {
  providers: WatchProviders;
  /** Plateformes de l'utilisateur (réglages) : mises en avant, en tête. */
  mine?: number[];
  /** Classes de la fiche hôte, pour que le bloc s'y fonde. */
  sectionClassName: string;
  titleClassName: string;
  /**
   * Logos seuls, le nom au survol : sous l'affiche, la colonne fait 280 px et
   * des pastilles nommées y passeraient une par ligne.
   */
  compact?: boolean;
}) {
  const isMine = (id: number) => mine.includes(canonicalProvider(id));
  const groups = GROUPS.map((g) => ({
    ...g,
    // Tri stable : les plateformes de l'utilisateur passent devant, l'ordre de
    // TMDB est conservé pour le reste.
    items: [...providers[g.key]].sort((a, b) => Number(isMine(b.id)) - Number(isMine(a.id))),
  })).filter((g) => g.items.length > 0);
  const included = providers.flatrate.some((p) => isMine(p.id));

  if (groups.length === 0) return null;

  return (
    <div className={`${sectionClassName} ${compact ? styles.compact : ""}`}>
      <div className={titleClassName}>Où regarder</div>
      {included && <div className={styles.included}>Inclus dans vos abonnements</div>}

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
                className={`${styles.provider} ${isMine(p.id) ? styles.mine : ""}`}
                title={isMine(p.id) ? `${p.name} — inclus dans vos abonnements` : p.name}
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
