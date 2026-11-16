/**
 * Listes fixes du catalogue TMDB : genres et plateformes.
 *
 * À part de `lib/tmdb.ts` pour que le proxy puisse valider les filtres de
 * « Découvrir » (cf. `discover-params`) sans embarquer tout le client TMDB.
 * Aucun import : ce module doit rester une simple liste de données.
 */

export const GENRES: Record<number, string> = {
  28: "Action", 12: "Aventure", 16: "Animation", 35: "Comédie",
  80: "Crime", 99: "Documentaire", 18: "Drame", 10751: "Famille",
  14: "Fantastique", 36: "Histoire", 27: "Horreur", 10402: "Musique",
  9648: "Mystère", 10749: "Romance", 878: "Science-Fiction", 53: "Thriller",
  10752: "Guerre", 37: "Western",
};

// Les séries ont leur propre nomenclature chez TMDB : « Action & Adventure »
// remplace Action et Aventure, « Sci-Fi & Fantasy » fusionne SF et Fantastique.
// Utiliser GENRES sur une série donnerait des filtres silencieusement vides.
export const TV_GENRES: Record<number, string> = {
  10759: "Action & Adventure", 16: "Animation", 35: "Comédie", 80: "Crime",
  99: "Documentaire", 18: "Drame", 10751: "Famille", 10762: "Enfants",
  9648: "Mystère", 10763: "Actualités", 10764: "Réalité", 10765: "Sci-Fi & Fantasy",
  10766: "Feuilleton", 10767: "Talk", 10768: "Guerre & Politique", 37: "Western",
};

/** Les plateformes se filtrent toujours pour une région donnée. */
export const WATCH_REGION = "FR";

/**
 * Plateformes proposées dans les filtres.
 *
 * TMDB en renvoie plus de 100 pour la France, dont une longue traîne de
 * micro-services : les lister toutes rendrait le filtre inutilisable. On garde
 * celles qui ont un vrai catalogue, dans l'ordre d'usage réel.
 */
// Identifiants vérifiés le 21/08/2026 contre /watch/providers/{movie,tv}
// pour watch_region=FR. Ne pas les deviner : plusieurs noms évidents pointent
// ailleurs (415 est Animation Digital Network et non OCS, 234 est Arte et non
// Paramount+). Les libellés sont ceux de TMDB, raccourcis quand ils sont longs.
/**
 * Plateformes proposées au filtrage, **par ordre alphabétique** : la liste est
 * lue dans un menu déroulant, où un ordre de popularité n'aide pas à trouver
 * une plateforme précise. Seuls consommateurs : les deux panneaux de filtres
 * Découvrir et l'ensemble d'identifiants connus de `watch-providers`.
 */
export const WATCH_PROVIDERS: Array<{ id: number; name: string }> = [
  { id: 350, name: "Apple TV+" },
  { id: 234, name: "Arte" },
  { id: 381, name: "Canal+" },
  { id: 283, name: "Crunchyroll" },
  { id: 337, name: "Disney+" },
  { id: 223, name: "Hayu" },
  { id: 1899, name: "HBO Max" },
  { id: 11, name: "MUBI" },
  { id: 8, name: "Netflix" },
  { id: 531, name: "Paramount+" },
  { id: 119, name: "Prime Video" },
  { id: 35, name: "Rakuten TV" },
];
