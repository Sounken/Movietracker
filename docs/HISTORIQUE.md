# Historique des modifications — MovieTracker

Ce qui a été fait, du plus récent au plus ancien. Ce qui reste à faire est dans [`TODO.md`](TODO.md). Le détail ligne à ligne est dans l'historique git ; on garde ici le **quoi**, et le **pourquoi** quand une décision ne doit pas être remise en question.

---

## Novembre 2026

### 2026-11-20 — Refonte « Nocturne » de toute l'application (commit `1ae318b`)

Charte et règles : [`DESIGN.md`](DESIGN.md).
- **Navigation** : en-tête global (marque, Films/Séries en liquid glass, navigation, menu « Plus », recherche avec `/`, notifications, compte) à la place de la barre latérale sur grand écran ; la barre du bas reste sur mobile.
- **Accueils Films et Séries** : hero plein cadre, file « Aussi cette semaine », stats en pastilles, collection en grille à défilement infini.
- **Fiches film et série refaites** :
  - hero, colonne de l'affiche collante, onglets ;
  - cartes « Les notes » (TMDB, amis, membres, répartition) et « Notes » ;
  - bande-annonce sous le synopsis, ROI et recettes en vert ou rouge ;
  - la carte « Tes amis » et le journal ont été retirés de la fiche.
- **« M'aider à noter »** (ex-« Grille Express ») enregistre le détail des critères : table `RatingDetail`, migration additive appliquée sur Neon avec accord.
- **Toutes les pages transposées** : profil, listes, journal, calendrier, amis, tendances, Ce soir, Moviedle, réglages, bilan, connexion, comparaison, 404.
- **Règles posées** : polices d'origine conservées, marge commune de 36px, retrait égal dans les coins, note perso à côté de l'année ou du genre, note TMDB sur les affiches.
- **Console** : nettoyage des avertissements Next (loader TMDB, LCP, logos, vignettes YouTube).
- **Décision** : TMDB ne publie pas la répartition de ses votes. Les notes des critiques TMDB (3 ou 4 par film) étaient un échantillon trop maigre et ne figurent plus dans le graphique ; seule la moyenne TMDB y reste, comme repère.

### 2026-11-20 — Grands écrans, Calendrier et Journal, rangement

- **Grands écrans** : zoom de l'interface par paliers au-delà de 1900px (`--ui-zoom`, borné aussi par la hauteur), pour retrouver sur un 2K ou un 4K les proportions du MacBook (hero aux deux tiers, 8 colonnes). Les hauteurs en `vh` sont compensées.
- **Calendrier** :
  - hero du prochain rendez-vous (compte à rebours, rappel, file « Ensuite ») ;
  - agenda du mois en cours et du suivant, avec les affiches dans les cases ;
  - rails « Plus tard » et « Sorti ces 7 derniers jours ».
- **Journal** :
  - stats de l'année ;
  - frise jour par jour, avec mois et jour records ;
  - mois par mois : nom du mois collant et grille d'affiches datées (badge « Revu », note perso).

### 2026-11-20 — Rangement du projet

- Composants partagés sortis des dossiers de routes : `components/home/` pour les accueils, `(standalone)/components/sheet/` pour les fiches ; fiches renommées `FilmSheet` / `SeriesSheet`.
- `task.md` et `TODO.md` fusionnés dans `docs/TODO.md`, plus le présent historique ; vrai README ; présentation de déploiement dans `docs/presentations/`.
- Hors dépôt, dossier `test/` : anciens prototypes HTML dans `archives/prototypes/`, polices, images et exports dans `ressources/`.

### 2026-11-18 — Huit fonctionnalités (commits `80d6789` → `4e8a85f`)

- **Réglages** : mes plateformes.
- **Journal** : table `FilmWatch`.
- **Bilan de l'année.**
- **Fil d'activité** des amis, avec réactions émoji.
- **Calendrier** des sorties, avec « me prévenir ».
- **Application installable** (PWA) et notifications push.
- **Alertes de disponibilité** : un film d'« À voir » arrive en streaming.
- **« Ce soir »** : que regarder à plusieurs (jusqu'à 5).
- Menu du compte en pied de barre latérale.

Décisions à ne pas redemander :
- une seule note par film (le journal date les visionnages) ;
- l'activité des amis en push est coupée par défaut ;
- « Ce soir » est limité aux amis réciproques (confidentialité des listes « À voir »).

Les tables `UserFollow`, `UserList` et `UserListFilm`, créées hors migrations, ont été rattrapées par `20261118090000_baseline_social_tables`.

### 2026-11-16 — Durcissement après le rapport de charge

- **Régulateur TMDB** derrière le cache : 3,9 → 162 pages/s sur Découvrir.
- **`/_next/image`** fermé aux sources distantes.
- **Limites de débit par IP** sur les routes coûteuses.
- **Validation** des filtres de Découvrir.
- **Route `/api/health`** et `curl` dans l'image Docker.

### Mot de passe oublié

Envoi d'un lien par e-mail via Resend (`lib/password-reset.ts`, pages `forgot-password` / `reset-password`). Date non consignée ; il avait été reporté en septembre, faute de service d'envoi.

---

## Septembre 2026

### 2026-09-22 — Moviedle codé

Le jeu : un film et une série mystère par jour.
- **Vivier** : `MIN_VOTES = { movie: 2000, tv: 500 }`, pour une notoriété comparable entre films et séries plutôt qu'un seuil identique.
- **Grille** : colonnes communes et colonnes propres aux films ou aux séries. Trois états (exact, partiel, rien), avec des tolérances : ±3 ans, ±15 min, ±1 saison, ±0,5 point.
- **Tirage du jour** figé dans `DailyPuzzle` (hachage FNV de `média:jour`), en excluant les 180 derniers jours.
- **Anti-triche** : la réponse ne quitte jamais le serveur.
- **Fuseau** : `parisDay()` en `Europe/Paris`, vérifié aux deux changements d'heure.
- Indices débloqués au fil des essais.

### 2026-09-21 — Mobile et finitions (lot J)

- **Grilles** : `auto-fill` avec des minimums adaptés au mobile.
- **Barre du bas** : indicateur en bas.
- **Pastille « Festivals » supprimée** : TMDB n'a aucune notion de festival.
- **Carrousel sur mobile** : voile vertical.
- **Filtres de note** repliés dans un seul bouton.
- **Loupe invisible corrigée** (conflit de spécificité CSS).
- **Thème clair supprimé** en entier.
- **Découvrir sur mobile** : filtres sur une ligne.
- **Listes d'amis** défilantes, avec une loupe qui gère les accents.
- **Déconnexion** en `--red-soft`.
- **Chiffres de Tendances** en New Kansas.
- **Textes de la page Amis** agrandis.
- **Topbar des fiches** collante (`overflow-x: clip`).
- **Carrousel « Cinémas »** : `/movie/now_playing` abandonné, il remontait des films qui ne sont pas en salle en France.

### 2026-09-20 — Retours d'usage (lot I)

- **Note** : confirmation « Note enregistrée », avis facultatif.
- **Recherche** : résultats en vrais liens. Cause réelle du clic qui ne naviguait pas : la revalidation de la fiche série à chaque épisode coché.
- **Retour** et **défilement restaurés** sur Découvrir (`useRestorableList`).
- **Scroll infini** de « Mieux notées » prolongé au-delà du vivier.
- **Barre latérale** sur les fiches (`AppShell`).
- **Animations** : deux passes.
- **Notifications** (table `Notification`, cloche) et libellé « Ami » réservé à la **réciprocité**. Suivre quelqu'un reste un abonnement à sens unique.

### Lot « Films / Séries / Global » (été 2026)

- **Films** :
  - loupe de recherche dans les collections, tri croissant ou décroissant au re-clic ;
  - filtres de période et de note minimale ;
  - « Mieux notés » en pondération bayésienne, et nouvelle sélection « Pour vous » ;
  - genres regroupés dans un menu ;
  - badge de niveau des amis ;
  - **comparaison avec un ami** ;
  - modale des rangs ;
  - pages Société de production ;
  - plateformes de streaming (JustWatch via TMDB).
- **Séries** :
  - accueil avec la collection notée ;
  - filtres et catégories « À venir » et « Pour vous » ;
  - correction de l'algorithme « Mieux notées » ;
  - tendances par période, avec genres populaires et utilisateurs actifs ;
  - fiche enrichie (créateurs, diffuseurs, prochain épisode…) ;
  - notation de saison ;
  - plateformes.
- **Global** : indicateur de navigation, animations d'apparition et de navigation, thème clair retravaillé (supprimé depuis), assistant de notation « Grille Express » (devenu « M'aider à noter »).
- **Correctifs du 27/08** :
  - modales ouvertes hors écran : `animation-fill-mode: both` créait un bloc conteneur, passé en `backwards` ;
  - contenu recentré sur grand écran ;
  - avis des amis placés avant la bande-annonce sur la fiche.

---

## Juillet 2026 et avant

- **Performance** :
  - cache des métadonnées TMDB en base (table `Film`) et lectures groupées `getFilmCards()` ;
  - classement des acteurs et Tendances mis en cache ;
  - index sur `UserFilm` ;
  - streaming avec `<Suspense>` ;
  - toutes les images via `next/image`.
  - Mesure de référence le 2026-07-25 : TTFB en cache de 127 à 190 ms.
- **Collections** : tri et filtres côté serveur sur toute la collection (`/api/collection`), scroll infini, collection du profil = films notés + bouton Watchlist.
- **Social** : profils publics (`/user/[id]`) et avis des amis sur la fiche film.
- **Interface** :
  - navigation mobile refaite (4 onglets + Menu) ;
  - logos officiels des films dans le carrousel ;
  - icônes lucide-react à la place des émojis ;
  - Retour et logo cliquable ;
  - films à l'affiche pour les visiteurs.
- **Séries** : monde dédié `/series/*`, avec les modèles `Series`, `UserSeries` et `UserEpisode`.
- **Règles** : noter un film le retire de « À voir ».
- **Outillage** :
  - CI GitHub Actions (lint bloquant, types, build) ;
  - `prisma migrate deploy` au démarrage du conteneur ;
  - dette lint soldée.

---

## Notes techniques à conserver

**« Mieux notés » (films et séries)** : formule bayésienne `WR = (v / (v + m)) × R + (m / (v + m)) × C`, où :
- `v` est le nombre de votes et `R` la note ;
- `m` est le seuil de votes, environ 1 000 pour les films et 500 pour les séries ;
- `C` est la moyenne globale, environ 6,8.

TMDB ne l'expose pas : on récupère plusieurs pages triées par note, avec un `vote_count.gte` bas, puis on re-trie côté serveur.

**« Pour vous »** : agréger les genres des films notés ≥ 7/10, pondérer par la note, puis `/discover` par popularité en excluant ce qui est déjà noté ou en watchlist.

**Plateformes** : données JustWatch via TMDB. L'attribution JustWatch est obligatoire.

**Saturation disque (27/08/2026)** : cause racine, `images.maximumDiskCacheSize` non renseigné. Next dimensionnait alors son cache d'images à **50 % du disque libre** au démarrage : jusqu'à 19 Go dans le conteneur. Correctifs :
- plafond à 256 Mo ;
- backdrops en `w1280` ;
- `lib/tmdb-image-loader.ts`, qui envoie TMDB et YouTube directement vers leurs CDN ;
- build `standalone` : 766 Mo → 45 Mo de modules.

**Migrations** : générer le SQL avec `prisma migrate diff` (jamais `migrate dev` contre Neon, puisque `.env.local` pointe sur la production) ; le conteneur les applique au démarrage.
