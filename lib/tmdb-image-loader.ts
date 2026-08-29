/**
 * Loader `next/image` — court-circuite l'optimiseur pour les images TMDB.
 *
 * Pourquoi : TMDB est déjà un CDN qui publie chaque visuel en plusieurs
 * largeurs (`/t/p/w342/…`, `/t/p/w780/…`). Les faire transiter par
 * `/_next/image` revenait à télécharger l'original depuis TMDB, le décoder en
 * bitmap, le réencoder en WebP et l'écrire dans `.next/cache/images` — pour
 * aboutir à un fichier que TMDB servait déjà, en mieux distribué. Sur un VPS
 * mutualisé, ce travail redondant tenait le CPU et la RAM occupés en
 * permanence, et le trafic sortant/entrant avec.
 *
 * Ce loader réécrit simplement le segment de taille de l'URL TMDB. Aucune
 * requête ne touche plus notre serveur pour ces images : c'est le CDN de TMDB
 * qui répond, gratuitement et depuis un point de présence proche du visiteur.
 *
 * Tout le reste — avatars, bannières, uploads locaux, vignettes YouTube —
 * continue de passer par l'optimiseur Next : ces fichiers-là ne sont servis
 * par personne d'autre, et leur volume est sans commune mesure.
 */

const TMDB_PREFIX = "https://image.tmdb.org/t/p/";

/**
 * Vignettes YouTube : elles aussi viennent d'un CDN, et à taille fixe
 * (`hqdefault.jpg`) — il n'y a même pas de variante à choisir. Les optimiser
 * ne produisait qu'une copie de plus à stocker dans le cache disque.
 */
const YOUTUBE_PREFIX = "https://i.ytimg.com/vi/";

/** Largeurs publiées par TMDB, communes aux affiches et aux arrière-plans. */
const TMDB_WIDTHS = [92, 154, 185, 342, 500, 780, 1280] as const;

/** Extrait la largeur du segment de taille d'une URL TMDB (`w780` → 780). */
function sourceWidth(sizeSegment: string): number {
  const m = /^w(\d+)$/.exec(sizeSegment);
  return m ? Number(m[1]) : Number.POSITIVE_INFINITY; // `original` et consorts
}

export default function tmdbImageLoader({
  src,
  width,
  quality,
}: {
  src: string;
  width: number;
  quality?: number;
}): string {
  if (src.startsWith(TMDB_PREFIX)) {
    const rest = src.slice(TMDB_PREFIX.length);
    const slash = rest.indexOf("/");
    // URL inattendue : on la laisse telle quelle plutôt que de la casser.
    if (slash === -1) return src;

    const size = rest.slice(0, slash);
    const path = rest.slice(slash + 1);

    // La plus petite largeur publiée qui couvre encore le besoin d'affichage.
    const fitting = TMDB_WIDTHS.find((w) => w >= width);

    // On ne remonte jamais au-dessus de la taille demandée à la source : le
    // carrousel réclame `100vw`, ce qui sur un grand écran ferait repasser un
    // backdrop `w1280` en `original` et annulerait le gain recherché.
    const capped = Math.min(fitting ?? Number.POSITIVE_INFINITY, sourceWidth(size));
    if (!Number.isFinite(capped)) return src;

    return `${TMDB_PREFIX}w${capped}/${path}`;
  }

  if (src.startsWith(YOUTUBE_PREFIX)) return src;

  // Images servies par nous : comportement Next d'origine.
  return `/_next/image?url=${encodeURIComponent(src)}&w=${width}&q=${quality ?? 75}`;
}
