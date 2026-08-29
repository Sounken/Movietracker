# TODO — Lot « Films / Séries / Global »

Légende : `[ ]` à faire · `[x]` fait · `[?]` besoin d'une décision de Damien

---

## 🎬 Films

### Accueil (`/films`)
- [x] **F1** — Loupe de recherche à gauche de « Récents » dans la toolbar de la collection ; au clic, filtre par titre.
- [x] **F2** — Clic sur un tri (Notes, Année, Récents) → ordre décroissant ; re-clic → croissant (indicateur ▲/▼).

### Découvrir (`/films/discover`)
- [x] **F3** — Ajouter des filtres : date de sortie (décennie / plage d'années) et note minimale.
- [x] **F4** — Corriger l'algo « Mieux notés » : pondération bayésienne (IMDb weighted rating) au lieu de `vote_count.gte=300`, pour sortir les faux positifs type *Socias por accidente* sans écarter les gros films peu votés.
- [x] **F5** — Nouvelle sélection **« Pour vous »** : recommandations basées sur les films les mieux notés de l'utilisateur + genres préférés.
- [x] **F6** — Regrouper les genres dans un bouton/dropdown au lieu de la rangée de pills.

### À voir (`/films/watchlist`)
- [x] **F7** — Même loupe de recherche que F1 (mutualisée dans `CollectionClient`).

### Amis (`/friends`)
- [x] **F8** — Afficher le niveau de l'ami en badge en bas à droite de sa photo.
- [x] **F9** — Page de **comparaison** avec un ami (façon Letterboxd) : films notés en commun, écart de notes, goûts partagés.

### Profil (`/films/profile`)
- [x] **F10** — Même loupe de recherche que F1.
- [x] **F11** — Clic sur le `profileBadge` → modale des rangs disponibles + progression ; rangs non atteints grisés.

### Fiche film (`/film/[id]`)
- [x] **F12** — Société de production cliquable → page listant ses films (TMDB `/discover/movie?with_companies=`).
- [x] **F13** — Liste des plateformes de streaming (TMDB `/movie/{id}/watch/providers`, région FR).

---

## 📺 Séries

### Accueil (`/series`)
- [x] **S1** — Remanier : supprimer « Populaires en ce moment » sous le carrousel, le remplacer par la collection notée de l'utilisateur (comme les films).
- [x] **S2** — Ajouter la section « 02 — Ma collection » complète : bouton « Ajouter une série », cartes de stats (`dashboard.stats`), filtres de tri, loupe — parité exacte avec `CollectionClient.toolbar` / `dashboard.stats` / `dashboard.sectionHead`.

### Découvrir (`/series/discover`)
- [x] **S3** — Filtres au niveau de ceux des films (`discover.filters`).
- [x] **S4** — Corriger le margin collé entre les filtres et la grille de séries.
- [x] **S5** — Même correction d'algo que F4 sur « Mieux notées » (Breaking Bad / Chernobyl doivent passer devant les séries obscures).
- [x] **S6** — Ajouter les catégories « À venir » et « Pour vous ».

### Tendances (`/series/trends`)
- [x] **S7** — Mieux délimiter les sections + corriger les marges.
- [x] **S8** — Filtres de période : Cette semaine / Ce mois / Cette année.
- [x] **S9** — Ajouter les blocs « Genres populaires » et « Utilisateurs actifs ».

### Fiche série (`/series/[id]`) — **le plus gros chantier**
- [x] **S10** — Refonte du style pour s'aligner sur la fiche film (`film.module.css`).
- [x] **S11** — Meilleure gestion de l'espace en largeur.
- [x] **S12** — Prévisualisation des étoiles au survol dans « Votre note ».
- [x] **S13** — Infos enrichies : créateurs, scénaristes, casting complet, diffuseurs, sociétés de production, prochain épisode, format, durée totale, pays, langue, popularité.
  **Budget / ROI : abandonnés** (décision Damien, 27/08/2026). TMDB n'expose ni `budget` ni `revenue` sur `/tv/{id}` ; les alternatives (saisie manuelle, Wikidata) coûtaient plus que ce qu'elles rapportaient. Ce qui est livré suffit, le point est clos.
- [x] **S14** — Aligner le texte du statut avec les lignes Saisons / Épisodes.
- [x] **S15** — Margin manquant entre le bouton « marquer la saison comme vue » et le `border-bottom` au hover.
- [x] **S16** — Notation de saison : le chiffre à droite décale les étoiles → largeur fixe.
- [x] **S17** — Liste des plateformes de streaming (TMDB `/tv/{id}/watch/providers`).

---

## 🌐 Global

- [x] **G1** — Refondre l'indicateur actif des `navLabel` : remplacer `box-shadow: inset 2px 0 0` par une vraie bordure dont la couleur ne se propage que sur la moitié de la hauteur.
- [x] **G2** — Motion UI : transitions de chargement, navigation sidebar, bascule Films/Séries (animation plutôt qu'un simple changement de couleur), ouverture des fiches film/série.
- [x] **G3** — Animations d'apparition sur certaines sections (stagger sur les grilles, fade-in des stats).

- [x] **G4** — Rework du thème clair + transition de bascule.
  - Palette « papier chaud » : le panneau blanc pur (luminance 1,0) sur fond quasi blanc (0,905) descend à 0,882 / 0,802 / 0,726. Les cartes se détachent enfin du fond au lieu de s'y fondre.
  - Contrastes revérifiés sur les **trois** surfaces et plus seulement sur `--bg` : mesurés sur `--bg-2`, `--ink-mute`, `--accent` et `--gold` étaient en réalité à 4,20-4,21:1, donc sous AA. Tout passe désormais ≥ 4,5:1.
  - Carrousel : les voiles codaient en dur les anciennes valeurs du thème et ne suivaient aucun changement de palette → passés en `--bg-rgb` / `--bg-2-rgb`. Les surcharges `#111` / `#666` / `#444` de `.title` / `.meta` / `.synopsis` supprimées (les règles de base utilisent déjà les tokens).
  - Logos de films : blancs pour la plupart, ils **disparaissaient** sur le voile clair. Détourés par un liseré de trois ombres serrées — l'inversion aurait cassé les logos colorés.
  - Bascule : fondu enchaîné via View Transitions (Chrome/Safari), repli par attribut temporaire `data-theme-switching` sur Firefox, et respect de `prefers-reduced-motion`.

- [x] **G5** — Assistant de notation (« Grille Express », d'après `ratinghelperV2.html`).
  Bouton « M'aider à noter » dans le widget de note des fiches film **et** série (le composant est partagé) ; ouvre une modale de huit critères en deux accordéons — Fabrication (58%) et Expérience (42%) — notés sur cinq niveaux pastel, plus deux accordéons d'ajustements optionnels plafonnés à ±1 point. Valider applique la note ; elle reste modifiable aux étoiles juste après.
  Formule isolée dans [lib/rating-assistant.ts](lib/rating-assistant.ts) pour rester testable. La note est calée sur la granularité réellement saisissable dans l'échelle de l'utilisateur (demi-point sur /10, dixième sur /100), sinon le bouton annoncerait 7,3 pour enregistrer 7,5.
  **Non fait volontairement** : le détail saisi n'est pas persisté (pas de migration Prisma), donc rouvrir l'assistant repart des valeurs par défaut. À trancher si on veut les stats de profil et les recos évoquées au cadrage.

---

## 🩺 Correctifs hors lot (27/08/2026)

- [x] **Modales ouvertes hors écran** — `.pageEnter` / `.stagger > *` utilisaient `animation-fill-mode: both` : l'animation restait en état de remplissage sur `transform`, ce qui crée un bloc conteneur permanent. Tous les `position: fixed` de l'app se résolvaient contre le contenu de la page (1212px de haut) au lieu du viewport. Passé en `backwards` — rendu identique, bloc conteneur libéré.
- [x] **Grand écran** — `.main` avait un `max-width` sans marges auto dans sa colonne `1fr` : tout le mou s'accumulait à droite (jusqu'à 320px de vide en 2560px). `margin-inline: auto`.
- [x] **Fiche film** — les avis des amis passent avant la bande-annonce.
- [x] **Charge serveur / images qui ne chargent pas** — voir la note technique en fin de fichier.

---

## Notes techniques

**F4 / S5 — algorithme « Mieux notés »**
Formule bayésienne : `WR = (v / (v + m)) × R + (m / (v + m)) × C`
où `v` = nombre de votes, `R` = note, `m` = seuil de votes (~1000 films / ~500 séries), `C` = moyenne globale (~6.8).
TMDB ne l'expose pas : on récupère plusieurs pages triées par `vote_average.desc` avec un `vote_count.gte` bas, puis on re-trie côté serveur.

**F5 / S6 — « Pour vous »**
Agréger les genres des films notés ≥ 7/10 par l'utilisateur, pondérer par la note, puis `/discover/movie?with_genres=…&sort_by=popularity.desc` en excluant ce qui est déjà noté/en watchlist.

**F13 / S17 — plateformes**
TMDB fournit bien `/watch/providers` (données JustWatch). Attention : l'attribution JustWatch est obligatoire dans les CGU TMDB.

**Charge serveur & images qui ne chargeaient pas (27/08/2026)**

**Cause racine — le plafond implicite du cache disque des images.** Non renseigné, `images.maximumDiskCacheSize` fait dimensionner le LRU de Next à **50% de l'espace disque libre mesuré au démarrage** (`disk-lru-cache.external.js` : `maxSize = Math.floor(bavail * bsize / 2)`). Next n'évince donc rien tant que ce budget n'est pas atteint : `/app/.next/cache` est monté jusqu'à **19 Go**, à ~1 Go/h, dans la couche inscriptible du conteneur (aucun volume persistant). Le calcul étant fait au démarrage et le disque partagé avec l'autre app, Next s'octroyait la moitié de ce qui était libre sans rien savoir du voisin — d'où la saturation attribuée à tort à myfrigo.

**Ce qui alimentait ce cache** : le carrousel d'accueil passait des backdrops TMDB `/original` — 2000 à 3800px, 1 à 3 Mo — dans l'optimiseur, avec `sizes="100vw"`. Chaque image était téléchargée depuis TMDB, décodée en bitmap brut (33 Mo pour un 3840×2160), réencodée en WebP à 3840px de large, puis stockée. D'où le CPU, la RAM et le trafic qui ne redescendaient jamais, et le volume écrit sur disque.

Quatre leviers :

0. `images.maximumDiskCacheSize: 256 Mo` — **le correctif décisif**. Sans lui, réduire le débit d'écriture ne fait que retarder l'échéance : le LRU vise toujours la moitié du disque.
1. `BACKDROP_SIZE = "w1280"` dans `lib/tmdb.ts` — couvre tous les écrans, poids divisé par 5 à 10. Profite aussi aux fiches film/série, où le backdrop en `background-image` faisait télécharger l'original au navigateur du visiteur.
2. `lib/tmdb-image-loader.ts` (`images.loaderFile`) — les visuels TMDB **et les vignettes YouTube** partent directement vers leurs CDN, qui publient déjà chaque image aux bonnes tailles. Plus aucune de ces requêtes ne touche le serveur, et rien de tout ça n'entre plus dans le cache disque. Le loader ne remonte jamais au-dessus de la taille de la source, sinon le `100vw` du carrousel ferait repasser un `w1280` en `original`. Ne restent à optimiser que nos propres avatars et bannières — quelques Mo, très loin des 256 Mo de plafond.
3. `output: "standalone"` + Dockerfile — l'image runtime embarquait 766 Mo de `node_modules` (binaires SWC et moteurs Prisma de toutes les plateformes, outillage de dev). Ramené à **45 Mo** de modules tracés. À multiplier par le nombre d'images conservées par Coolify.

Reste à faire côté serveur, hors dépôt : purger les images Docker (`docker system prune -af`) et régler la saturation disque causée par l'autre app.

