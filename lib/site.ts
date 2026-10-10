/**
 * Identité publique du site, partagée par les métadonnées, le sitemap et les
 * données structurées.
 *
 * L'adresse est écrite en dur, avec une variable d'environnement possible pour
 * la surcharger : sans adresse absolue, Next.js ne peut pas produire les URL
 * canoniques ni celles des images de partage, et un aperçu Discord ou WhatsApp
 * sans image absolue n'affiche rien.
 */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://movietracker.fr").replace(/\/$/, "");

export const SITE_NAME = "MovieTracker";

export const SITE_DESCRIPTION =
  "Notez les films et séries que vous regardez, suivez vos épisodes, gardez une liste à voir et trouvez où les regarder en streaming. Gratuit.";

/** Base commune des aperçus de lien : une page qui redéfinit `openGraph` l'écrase en entier. */
export const BASE_OPEN_GRAPH = {
  siteName: SITE_NAME,
  locale: "fr_FR",
  type: "website",
} as const;
