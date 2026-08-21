import { ExternalLink } from "lucide-react";
import type { TmdbExternalIds } from "@/lib/tmdb";
import styles from "./ExternalLinks.module.css";

/**
 * Liens vers les fiches externes.
 *
 * Rendu côté serveur, sans état : ce sont de simples ancres, il n'y a aucune
 * raison d'embarquer du JavaScript pour ça.
 */
export default function ExternalLinks({
  ids,
  homepage,
}: {
  ids: TmdbExternalIds;
  /** Site officiel, quand TMDB le connaît. */
  homepage?: string;
}) {
  const links: Array<{ label: string; href: string }> = [];

  if (ids.imdbId) {
    // Les identifiants « tt… » sont des titres, « nm… » des personnes.
    const path = ids.imdbId.startsWith("nm") ? "name" : "title";
    links.push({ label: "IMDb", href: `https://www.imdb.com/${path}/${ids.imdbId}/` });
  }
  if (homepage) links.push({ label: "Site officiel", href: homepage });
  if (ids.instagramId)
    links.push({ label: "Instagram", href: `https://www.instagram.com/${ids.instagramId}/` });
  if (ids.twitterId) links.push({ label: "X", href: `https://x.com/${ids.twitterId}` });
  if (ids.facebookId)
    links.push({ label: "Facebook", href: `https://www.facebook.com/${ids.facebookId}` });
  if (ids.wikidataId)
    links.push({ label: "Wikidata", href: `https://www.wikidata.org/wiki/${ids.wikidataId}` });

  if (links.length === 0) return null;

  return (
    <div className={styles.wrap}>
      {links.map((l) => (
        <a
          key={l.label}
          href={l.href}
          target="_blank"
          rel="noopener noreferrer"
          className={styles.link}
        >
          {l.label}
          <ExternalLink size={11} />
        </a>
      ))}
    </div>
  );
}
