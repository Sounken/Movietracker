import Image from "next/image";
import type { WatchProviders } from "@/lib/tmdb";
import styles from "./WatchProvidersSection.module.css";

const GROUPS = [
  { key: "flatrate", label: "En abonnement" },
  { key: "rent", label: "En location" },
  { key: "buy", label: "À l'achat" },
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
}: {
  providers: WatchProviders;
  /** Classes de la fiche hôte, pour que le bloc s'y fonde. */
  sectionClassName: string;
  titleClassName: string;
}) {
  const groups = GROUPS.map((g) => ({ ...g, items: providers[g.key] })).filter(
    (g) => g.items.length > 0,
  );

  if (groups.length === 0) return null;

  return (
    <div className={sectionClassName}>
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
