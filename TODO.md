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
- [~] **S13** — Infos enrichies : créateurs, scénaristes, casting complet, diffuseurs, sociétés de production, prochain épisode, format, durée totale, pays, langue, popularité.
  **Budget / ROI non livrés** : TMDB n'expose ni `budget` ni `revenue` sur les séries (`/tv/{id}`), contrairement aux films. Il faudrait une autre source (saisie manuelle, ou API tierce type Wikidata). → décision à prendre.
- [x] **S14** — Aligner le texte du statut avec les lignes Saisons / Épisodes.
- [x] **S15** — Margin manquant entre le bouton « marquer la saison comme vue » et le `border-bottom` au hover.
- [x] **S16** — Notation de saison : le chiffre à droite décale les étoiles → largeur fixe.
- [x] **S17** — Liste des plateformes de streaming (TMDB `/tv/{id}/watch/providers`).

---

## 🌐 Global

- [x] **G1** — Refondre l'indicateur actif des `navLabel` : remplacer `box-shadow: inset 2px 0 0` par une vraie bordure dont la couleur ne se propage que sur la moitié de la hauteur.
- [x] **G2** — Motion UI : transitions de chargement, navigation sidebar, bascule Films/Séries (animation plutôt qu'un simple changement de couleur), ouverture des fiches film/série.
- [x] **G3** — Animations d'apparition sur certaines sections (stagger sur les grilles, fade-in des stats).

- [ ] G4 — Rework du theme clair car la il explose les yeux, le contrast n'est pas forcément super, surtout sur le hero caroussel. Aussi ajouter une belle transition motion entre le mode clair et le mode sombre.

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

