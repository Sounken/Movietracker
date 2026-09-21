# 🎬 Movietracker — Backlog des modifications

> Plan de travail. Chaque tâche est reliée aux fichiers réels du projet.
> Workflow : une tâche codée → `git push` → CI GitHub Actions (typecheck + build) → Coolify déploie
> et applique les migrations Prisma au démarrage du conteneur → https://movietracker.fr

Légende : 🟢 simple · 🟡 moyen · 🔴 gros / à cadrer

---

## ✅ Terminé

| Réf | Tâche | Résultat |
|---|---|---|
| **G1** | Cache métadonnées TMDB en base (table `Film` + `getFilmCard`) | Les listes lisent en base au lieu d'appeler TMDB film par film |
| **G2** | Classement acteur mis en cache (`unstable_cache` 24 h) | Fin des 250 requêtes TMDB par affichage de page acteur |
| **G3** | Page Tendances mise en cache (`unstable_cache` 10 min) | Plus de recalcul + refetch TMDB à chaque visite |
| **G4** | Index DB sur `UserFilm` | Listes et agrégations Tendances accélérées |
| **C5** | Noter un film le retire de la watchlist | `saveRating` + `addFilm` passent `watchlist: false` |
| **D6** | Tendances épurées | Période « Tout » et carte « En watchlist » retirées (onglet Watchlist conservé) |
| **C4-bis** | Bouton Watchlist du carrousel corrigé | État initial synchronisé depuis le serveur, icône ✓, retrait au reclic (optimiste + rollback) |
| **H10** | Retour arrière + logo cliquable | Bouton « Retour » sur `/login`, logo/marque → accueil (sidebar, login, register) |
| **A1** | Films à l'affiche pour les visiteurs | Bandeau `01 — Sorties récentes` + carrousel sur `/discover`, Explorer renuméroté en `02` |
| **P1** | **Profils publics des autres utilisateurs** | Nouvelle page `/user/[id]` (infos, niveau/XP, stats, films préférés, films notés, bouton S'abonner) + liens cliquables depuis Amis (abonnements, abonnés, recherche, activité) et Tendances (utilisateurs actifs, auteurs d'avis) |
| — | **CI/CD** | GitHub Actions (typecheck + build, sans secret) + `prisma migrate deploy` au démarrage du conteneur |
| **S13** | **Avis des amis sur la fiche film** | Section « Ce qu'en pensent tes amis » (avatar, nom cliquable → `/user/[id]`, note ★, avis, date), 2 avis max + bouton « Afficher plus d'avis », masquée si non connecté ou aucun avis d'ami |
| **H14** | **Icônes lucide-react à la place des emojis** | Emojis décoratifs remplacés partout (cartes de stats, listes, fiche film, modales, amis) ; `UserList.emoji` et le ★ de notation conservés |
| **G6** | **Images via `next/image`** | Tous les posters/avatars/carrousel/vignettes migrés, `priority` sur le LCP ; + 2 hotfixes prod (voir G6 ci-dessous) |
| **G7** | **Lectures groupées `getFilmCards()`** | Accueil, profil, tendances, watchlist, favoris, listes et amis basculés — 1 requête DB par page au lieu d'une par film |
| **G5** | **Streaming `<Suspense>`** | Accueil (carrousel + collection/stats), profil (stats, favoris, collection) et tendances streamés avec skeletons |
| — | **Passe lint + gate CI** | 15 erreurs/warnings react-hooks et vars inutilisées corrigés, `npx eslint` à zéro, étape **Lint bloquante** réactivée dans `ci.yml` |

---

## I. 🔧 Retours d'usage — septembre 2026

Lot issu des retours d'utilisation du 20/09, poussé sur `main` le 20/09 au soir.
La migration `20260920120000_add_notifications` s'applique au démarrage du conteneur.

| Réf | Tâche | État |
|---|---|---|
| **I1** | Notation : la note partait déjà au clic, mais le bouton « Sauvegarder » laissait croire qu'il fallait valider | ✅ confirmation « Note enregistrée », avis marqué facultatif, bouton actif seulement si le texte a changé |
| **I2** | Inscription : prénom suggéré « Damien » | ✅ « Votre prénom » |
| **I3** | Recherche : un résultat cliqué ne naviguait qu'au clic suivant (signalé depuis une fiche série) | ✅ résultats transformés en `<Link>` — navigation par le navigateur, préchargée, accessible au clavier |
| **I14** | **Cause réelle du I3** : `toggleEpisode` revalidait la fiche série elle-même, donc un rendu serveur complet par case cochée ; les Server Actions étant sérialisées, la navigation attendait son tour | ✅ la fiche n'est plus revalidée sur le suivi d'épisode (suivi déjà optimiste) ; les pages de liste le restent |
| **I4** | Connexion : bouton retour collé à la marque | ✅ les deux sont des éléments en ligne, donc côte à côte sans rien entre eux — 18 px d'écart explicite. Deux tentatives ratées avant : marge basse (sans effet), puis passage en bloc (les séparait mais déséquilibrait la carte) |
| **I5** | Amis : résultats de recherche collés à la liste | ✅ `.page > .section` prend une marge basse |
| **I6** | Découvrir : scroll et pages chargées perdus au retour arrière | ✅ hook `useRestorableList` (sessionStorage par URL + filtres), films et séries |
| **I7** | Séries « Mieux notées » : scroll infini qui s'arrête | ✅ le vivier classé (5 pages × 3 sources) est prolongé par TMDB au-delà, doublons écartés — vaut aussi pour les films |
| **I8** | Barre latérale absente des fiches film/série sur grand écran | ✅ shell extrait en `AppShell`, partagé par `(app)` et `(standalone)` — **à valider visuellement** |
| **I13** | Séries : la note de la collection s'affichait « Ma note : 8,5 » en texte, illisible face au `★` des films | ✅ même rendu que les films (`★` + composant `Rating`) |
| **I9** | Motion / micro-interactions | ✅ deux passes. D'abord les manques évidents (`:focus-visible`, enfoncement des boutons, retombée des cartes, apparition des menus). Puis la compétence `interaction-design` appliquée : échelle de courbes complétée (`--ease-in`, `--ease-in-out`, `--spring`, `--dur-exit`), **animations de sortie** sur le menu de recherche et le panneau de notifications, barre du carrousel passée en `scaleX`, ressort sur la confirmation de note |
| **I10** | Amis : « ami » doit désigner une relation réciproque, + notification quand quelqu'un s'abonne | ✅ table `Notification` (+ migration), cloche fonctionnelle avec pastille et panneau, libellé « Ami » des deux côtés — **migration à appliquer au déploiement** |
| **I11** | Mot de passe oublié | ⏸️ reporté — aucune dépendance d'envoi d'e-mail, choix du service à faire |
| **I12** | Notes IMDb plutôt que TMDB | ⏸️ reporté — options étudiées : import quotidien du dataset (~50-80 Mo sur les 500 Mo Neon, + une lecture DB sur les fiches anonymes) ou OMDb à la demande (1 000 req/jour en gratuit) |

**Décidé pour I10** : suivre quelqu'un reste un abonnement à sens unique — il apparaît
dans « Abonnements » et son activité dans le fil. Le libellé **« Ami » n'apparaît qu'en
réciprocité**. Le fil d'activité et les avis sur les fiches ne changent pas.

---

## J. 📱 Mobile & finitions — septembre 2026

Lot issu d'une passe sur téléphone du 21/09. Sauf mention contraire, tout est à
faire **sous les points de rupture mobiles uniquement** : le rendu bureau ne bouge pas.

| Réf | Tâche | État |
|---|---|---|
| **J1** | Grille de films : 2 colonnes quelles que soient les dimensions du téléphone, alors que les grands écrans ont la place pour plus | ✅ `auto-fill` rétabli avec des minimums adaptés plutôt que des paliers par modèle : 140px entre 521 et 768px, **92px en dessous** — soit `floor((largeur + 10) / 102)` colonnes, donc 3 sur un SE ou un 16 Pro, 4 sur un Pro Max, 2 sous 330px. `sizes` de `next/image` ramené de `50vw` à `30vw` en conséquence |
| **J2** | Onglet actif de la barre de navigation : liseré **à gauche** même quand la barre est passée en bas de l'écran | ✅ dans le bloc mobile, l'indicateur passe en bas, pleine largeur, et l'animation porte sur la largeur. Le dégradé est redéclaré : `.navItem.active::before` (0,2,1) écrasait sinon le dégradé horizontal par le vertical, qui délave une barre de 3px. Amorce de survol neutralisée — au doigt, un survol rémanent allumait un onglet inactif |
| **J3** | Pills « Cinémas / Streaming / Festivals » | ✅ **Festivals supprimée** — TMDB n'a aucune notion de festival ; le plus proche, `with_release_type=1` (« Premiere »), ne nomme pas le festival et est très inégalement renseigné, et les distinctions Wikidata de [awards.ts](lib/awards.ts) se lisent film par film, après coup. **Cinémas et Streaming câblées** sur `?source=…`, comme les filtres de Découvrir : `fetchNewOnStreaming()` interroge `/discover/movie` avec les 12 plateformes, `watch_region=FR` et `with_watch_monetization_types=flatrate`, sur une fenêtre de **30 jours** avec un plancher de **25 votes**. Tri par popularité, **mesuré** : trié par date, le haut de liste était un documentaire à 0 vote, deux spectacles de stand-up et un film érotique ; la popularité TMDB décroît avec le temps, donc sur un mois elle classe « les grosses sorties récentes ». Repli à 90 jours si le vivier descend sous 7 affiches. ⚠️ **TMDB n'expose pas de date d'ajout au catalogue** (JustWatch = disponible *maintenant*), mais la chronologie des médias joue en notre faveur : un film sorti en salle il y a moins d'un mois n'est pas encore en SVOD en France, donc ce qui remonte est très majoritairement de la production de plateforme, sortie directement en streaming |
| **J4** | Carrousel héro en mobile : l'image de fond ne se voit presque pas | ✅ `min-height` 520 -> **420px**, titre 34 -> 28px, logo 64 -> 48px, et surtout deux changements de fond : le voile oblique du bureau (105deg, qui s'éteint à 65% de la largeur) est **redressé à la verticale** en mobile — sur une colonne étroite il recouvrait presque toute l'affiche — et le contenu passe en `justify-content: flex-end`, ce qui dégage la partie haute de l'image, là où se trouve presque toujours le sujet |
| **J5** | « Ma collection » en mobile : un bouton par filtre, dont « note min » et « note max » séparés → plusieurs lignes | ✅ « Note min » et « Note max » repliées dans un bouton **« Note »** qui porte la valeur active (`≥ 6`, `6 – 8`), avec un dépliant Minimum/Maximum fermé au clic extérieur et à Échap. **Appliqué à toutes les largeurs** et pas seulement au mobile : deux mises en page parallèles pour le même filtre finiraient par diverger |
| **J6** | « Ma collection » : au clic sur la loupe, l'icône reste blanche sur fond clair — invisible | ✅ **conflit de spécificité** : `.sortBtn:hover` (0,2,0) l'emportait sur `.sortOn` (0,1,0), donc au clic — pointeur toujours sur le bouton — la couleur repassait à `--ink`, exactement le fond de l'état actif. `.sortOn:hover` ajouté. Corrige aussi le libellé du tri courant, invisible pour la même raison. Classe fantôme `styles.searchOpen` (absente du module) retirée au passage |
| **J7** | Thème clair | ✅ supprimé en entier : **35 règles** `:global([data-theme="light"])` dans 14 modules CSS, le bloc `:root[data-theme="light"]`, le sélecteur de la Topbar (avec son `useSyncExternalStore`, ses icônes et `flushSync`), le script anti-flash du `<head>` de [layout.tsx](app/layout.tsx), et toute la mécanique de bascule (View Transitions + repli `data-theme-switching`), qui ne servait qu'à ça. **Périme H11** (contraste du mode clair) |
| **J8** | Découvrir en mobile : 5 boutons répartis sur plusieurs lignes | ✅ `nowrap` sous 520px, typographie et marges resserrées (11px, 7/8px, gouttière 4px) plutôt que des libellés tronqués. `overflow-x: auto` en filet, barre masquée : les libellés films tiennent dans 343px, mais « En diffusion » côté séries déborde un peu sur les écrans les plus étroits |
| **J9** | Amis : listes affichées en entier | ✅ au-delà de 5 entrées, chaque liste défile sur elle-même (barre fine maison) et son en-tête reçoit une **loupe repliée** filtrant par nom, avec normalisation des accents — « Amelie » trouve « Amélie ». Hauteurs de ligne distinctes pour les deux listes (« Tu suis » porte une ligne de méta en plus). ⚠️ **Côté requête, rien n'a changé et c'est volontaire** : défilement et recherche client supposent les listes chargées en entier. Le coût restant n'est pas le nombre d'utilisateurs mais le `films: { select: XP_SELECT }` qui charge toute la collection de chacun pour calculer son niveau — optimisable en agrégat SQL (la formule de `computeXP` est une somme de conditions par ligne), à décider séparément |
| **J10** | Bouton « Se déconnecter » en mobile | ✅ jeton `--red-soft` ajouté aux deux thèmes (`#e7a39b` sombre, `#a8503c` clair pour le contraste) et appliqué à l'entrée de déconnexion de la feuille mobile. Pas `--red`, gardé pour les erreurs et les suppressions |
| **J11** | Tendances : « ancienne police » | ✅ **revu après vérification visuelle** : la typographie de la page convient, seuls les **chiffres** passaient en Geist Mono. Les neuf classes qui ne portent qu'un nombre (`statValue`, `rankNum`, `rankCount`, `sectionCount`, `rankRating`, `reviewRating`, `genrePercent`, `userRank`, `userCount`) passent en `--font-serif`, avec `font-weight: 400` là où il valait 500 — le fichier New Kansas ne contient que le gras, un poids intermédiaire donnerait un gras synthétique. Les titres de section restent en micro-labels |
| **J12** | Amis : texte trop petit | ✅ échelle remontée d'un cran (10→11, 11→12, 12→13, 13→14) ; 14px et le titre de page inchangés. Hauteur de ligne du défilement de J9 réajustée en conséquence |
| **J13** | Fiches film/série : la topbar ne restait pas collée en haut, et la marque doublait le bouton Retour | ✅ `position: sticky` était bien déclarée mais inopérante : `.mainFlush` portait `overflow-x: hidden`, ce qui force le calcul de `overflow-y: auto` et fait de la colonne un conteneur de défilement — la barre s'ancrait à lui, qui ne défile jamais. Passé en `overflow-x: clip`, qui rogne sans créer de conteneur. Marque « Movietracker » retirée de la barre |

---

## H. 🎨 Interface & ergonomie (nouveaux retours)

### H9. ✅ Barre de navigation mobile — refaite
**Fait** : barre du bas limitée à **4 onglets + Menu**.
- Connecté : Accueil · Découvrir · À voir · Profil + **Menu** (Mes listes, Favoris, Amis, Tendances, Se déconnecter).
- Non connecté : Découvrir · Tendances · Connexion (pas de menu, rien à y mettre).
- Icônes 24 px, cibles tactiles ≥ 48 px, onglets qui se répartissent la largeur (plus de débordement).

<details><summary>Contexte initial (résolu)</summary>
Sur mobile, la barre du bas ([Sidebar.tsx](app/(app)/components/Sidebar.tsx)) pose deux problèmes opposés :
- **Non connecté** : seulement **2 icônes**, et elles sont **trop petites** → ça fait vide et peu lisible.
- **Connecté** : **trop d'icônes** entassées → illisible.

**Pistes à trancher :**
- Agrandir les icônes + libellés (cibles tactiles ≥ 44 px).
- **Non connecté** : enrichir avec les entrées pertinentes (Découvrir, Tendances, Se connecter) pour remplir la barre.
- **Connecté** : limiter à 4-5 entrées principales + un bouton **« Plus »** ouvrant un menu (ou un onglet Profil regroupant les entrées secondaires).
- Vérifier les `authOnly` des items de nav ([Sidebar.tsx:66](app/(app)/components/Sidebar.tsx#L66)).
</details>

### H14. ✅ Icônes lucide-react à la place des emojis
**Fait** : `lucide-react` installé, tous les emojis décoratifs remplacés par des icônes (imports nommés, `currentColor` → suivent le thème) : cartes de stats du [profil](app/(app)/profile/page.tsx), du [profil public](app/(app)/user/[id]/page.tsx) et des [tendances](app/(app)/trends/TrendsClient.tsx) (`StatCard`/`PreviewStat` prennent désormais un composant icône), fiche film, modales (`✕`→`X`, `✎`→`Pencil`, `📷`→`Camera`, `✓`→`Check`, `✦`→`Sparkles`), amis (`❤️`→`Heart` plein). Conservés : l'**emoji des listes** (`UserList.emoji`, donnée utilisateur) et le `★` typographique des notes.

<details><summary>Contexte initial (résolu)</summary>
Aujourd'hui l'interface mélange **emojis** (🎬 ⭐ ⏱ ❤️ 📋 👁 ✍ 🕐 …) et **SVG maison** (les icônes de la sidebar, du carrousel…). Les emojis posent plusieurs problèmes : rendu **différent selon l'OS** (Apple / Windows / Android), alignement vertical hasardeux, taille et couleur non contrôlables, et style incohérent avec les SVG existants.

**Repérage** : ~20 fichiers concernés, dont les cartes de stats du [profil](app/(app)/profile/page.tsx#L118) et du [profil public](app/(app)/user/[id]/page.tsx#L143), les [tendances](app/(app)/trends/TrendsClient.tsx), les [listes](app/(app)/lists/ListsClient.tsx), la [fiche film](app/(standalone)/film/[id]/page.tsx) et les modales.

**À décider :**
- **Quelle librairie** : `lucide-react` (léger, tree-shakable, style très proche des SVG déjà en place — recommandé), `react-icons` (très large mais plus lourd), ou continuer en SVG maison centralisés dans un fichier `components/icons.tsx`.
- **Périmètre** : tout d'un coup, ou d'abord les cartes de stats (les plus visibles) puis le reste.
- ⚠️ Cas à conserver : l'**emoji des listes utilisateur** (`UserList.emoji`, choisi par l'utilisateur) doit rester un emoji — c'est une donnée, pas une icône d'interface.

**Bénéfices attendus** : cohérence visuelle, contrôle de la taille/couleur (`currentColor` → suit le thème clair/sombre), et meilleur alignement.
</details>

---

### H11. ⬛ Mode clair — contraste corrigé *(périmé : thème clair supprimé, cf. J7)*
**Fait** dans [globals.css](app/globals.css) : `--ink-dim` 2,1:1 → **6:1**, `--ink-mute` 1,7:1 → **4,7:1**, ajout des overrides clairs pour `--accent` (3,2 → 4,6:1) et `--accent-soft` (2:1 → 5,9:1), bordures un peu plus marquées. Nouvelles variables `--hover` / `--hover-strong` / `--track` (voile sombre en thème clair au lieu d'un blanc invisible).

<details><summary>Contexte initial (résolu)</summary>
Le thème clair manque de contraste, certains textes sont difficiles à lire.

**À faire :**
- Auditer les variables de couleur du thème clair (fichiers CSS globaux / `*.module.css`).
- Viser les ratios **WCAG AA** (≥ 4.5:1 pour le texte courant, ≥ 3:1 pour le texte large).
- Vérifier en priorité : textes secondaires/atténués, libellés de stats, placeholders, bordures de cartes.
</details>

> ⏳ Reste éventuellement : passer en revue les autres `rgba(255,255,255,…)` codés en dur (~24 restants, surtout sur images sombres donc légitimes) et vérifier le rendu clair page par page.

### H12. ✅ Carrousel : logo du film au lieu du titre texte
**Fait** : `fetchFilmLogo()` dans [lib/tmdb.ts](lib/tmdb.ts) (endpoint `/movie/{id}/images`), priorité **fr → en → sans langue**, puis le mieux noté. Filtres : **PNG** + **ratio ≥ 1,2** (les logos hauts/étroits sont écartés). Affichage contraint (`max-height: 120px` desktop / 76px mobile, `max-width` limitée) avec **repli sur le titre texte** si aucun logo, format inadapté, ou erreur de chargement.
⏳ Optionnel : stocker `logoUrl` dans la table `Film` pour survivre aux redéploiements (aujourd'hui cache `fetch` 24 h, ~7 requêtes par déploiement).

<details><summary>Contexte initial (résolu)</summary>
TMDB fournit les **logos officiels** des films (endpoint `/movie/{id}/images` → tableau `logos`, avec langue `iso_639_1`). Remplacer le titre stylisé du carrousel (`HeroCarousel … .title`) par le logo du film, qui contient déjà le titre.

**À faire :**
- Étendre [lib/tmdb.ts](lib/tmdb.ts) : `fetchFilmLogo(id)` → choisir le logo en **fr**, sinon **en**, sinon sans langue ; renvoyer `null` si aucun.
- **Garde-fous demandés** :
  - **`max-height` stricte** sur le logo (et `max-width`) pour qu'il ne déborde jamais.
  - **Fallback sur le titre texte** si : aucun logo, format/ratio inadapté (logo trop haut/étroit), ou image en erreur.
- 💡 Synergie : stocker `logoUrl` dans la table cache `Film` (déjà créée en G1) pour éviter un appel TMDB par affichage.
</details>

---

## S. Social & communauté

### S13. ✅ Afficher les avis de nos amis sur la fiche d'un film
**Fait** : section « Ce qu'en pensent tes amis » sur [la fiche film](app/(standalone)/film/[id]/page.tsx) — `UserFilm` du film dont l'auteur est suivi (`UserFollow.followerId = session`), avec note et/ou avis (`review != ""`), triés par `updatedAt desc`. Affichage dans un composant client dédié [`FriendReviews.tsx`](app/(standalone)/film/[id]/components/FriendReviews.tsx) : avatar (ou initiale), nom cliquable → `/user/[id]`, note ★, texte, date `fr-FR`. **2 avis max** puis bouton « Afficher plus d'avis (N) » / « Réduire » (même pattern que `CastGrid`). Section masquée si non connecté ou aucun avis d'ami.

<details><summary>Contexte initial (résolu)</summary>
Sur la page d'un film ([app/(standalone)/film/[id]](app/(standalone)/film/[id]/page.tsx)), afficher les **notes et avis des personnes qu'on suit** pour ce film.

**À faire :**
- Récupérer les `UserFilm` du film courant dont le `userId` fait partie des personnes suivies (`UserFollow` où `followerId = session.userId`), avec une note et/ou un avis.
- Afficher : avatar + nom (cliquable → `/user/[id]`), note ★, texte de l'avis, date.
- Section masquée si on n'est pas connecté ou si aucun ami n'a vu le film.
- Penser à l'index : la requête filtre sur `tmdbId` + `userId IN (...)` — `@@index([tmdbId])` existe déjà.
</details>

---

## B. Listes de films — tri, pagination, scroll

### B2. ✅ Tri et filtres serveur sur toute la collection
**Fait** : `/api/collection` accepte désormais `sort` (`recent|rating|year`), `minRating`, `maxRating`, `year` et `ratingField`. Le tri et la pagination se font **en base** via une requête SQL avec jointure `UserFilm ⟕ Film` (l'année vit dans la table cache `Film`), donc sur **toute** la collection et non plus sur les films déjà chargés. Fragments SQL en liste blanche, valeurs toujours paramétrées. L'API renvoie aussi la liste complète des **années disponibles** pour le menu déroulant. `CollectionClient` est maintenant **piloté par le serveur** : tout changement de tri/filtre recharge la page 0.

### B3. ✅ Scroll infini
**Fait** : `IntersectionObserver` (marge de 400 px pour anticiper) dans `CollectionClient`, `FilmGridInfinite` et `DiscoverGrid`. Le bouton « Charger plus » reste présent en repli (accessibilité / JS lent), et un verrou évite les chargements en double.

<details><summary>Contexte initial (résolu)</summary>

#### Bug d'origine : le tri (note / année) ne portait que sur les films déjà chargés
Dans [CollectionClient.tsx](app/(app)/components/CollectionClient.tsx), le tri/filtre se fait **côté client** sur les films déjà chargés, pas sur toute la collection ([CollectionClient.tsx:44-56](app/(app)/components/CollectionClient.tsx#L44)). Trier par note ne classe qu'un sous-ensemble, et « charger plus » remélange la liste.

**Cause :** l'API [collection/route.ts](app/api/collection/route.ts) ne trie que par `updatedAt: desc` et n'accepte ni tri ni filtre.

**Approche :** passer le tri/filtre **côté serveur**, sur toute la collection.
1. Étendre `GET /api/collection` : `sort` (`recent|rating|year`), `order`, filtres (`minRating`, `maxRating`, `year`) → tri + pagination en base.
2. Rendre `CollectionClient` **piloté par le serveur** : à chaque changement de tri/filtre, refetch page 0.

> ⚠️ **Point technique à trancher (tri par année)** : `year` vit désormais dans la table `Film` (G1), pas dans `UserFilm`. Pour trier par année en base il faut soit :
> - ajouter une **relation** `UserFilm ↔ Film` — attention, une vraie clé étrangère exigerait qu'une ligne `Film` existe pour **chaque** `UserFilm`, or le cache se remplit **paresseusement** ;
> - soit **dénormaliser `year`** directement sur `UserFilm` ;
> - soit faire une **requête SQL avec jointure** manuelle.
> → **B2 conditionne B3** (même composant).

</details>

---

## E. Profil

### E7. ✅ « Ma collection » du profil = films notés + filtre Watchlist
**Fait** : le profil n'affiche plus que les **films notés** (`type="rated"`), et `CollectionClient` a une nouvelle prop `showWatchlist` qui ajoute un bouton **Watchlist** à côté de `Récents / Notes / Année`. La watchlist est chargée à la demande (au premier clic) puis gardée en mémoire, avec sa propre pagination « charger plus ».

---

## F. Grande fonctionnalité — Séries 📺 (à cadrer ensemble)

### F8. 🟡 Séries — monde dédié /series/* (en cours)
**Fait** : architecture « tout séparé » (Films sous /films/*, Séries sous /series/*, switch dans la sidebar). Modèles Series/UserSeries/UserEpisode, fiche série + suivi par épisode, recherche films+séries, accueil séries (En cours/notées/populaires), découverte + filtre Anime, watchlist/favoris/profil/tendances séries, XP + compteurs section-aware.
**Reste** : listes séries (nouveau modèle UserSeriesList), avis des amis sur les séries, intégration anime plus poussée si besoin.

<details><summary>Brainstorm initial</summary>
Tout est pensé « film » (TMDB `movie`, `UserFilm`, `getFilmCard`…).

**Questions à trancher avant de coder :**
- **Données** : modèle `UserSeries` (suivi par saison/épisode ?) ou modèle générique `UserMedia` avec `type: film|serie` ? Impact sur toutes les requêtes.
- **TMDB** : endpoints `tv/*`. Adapter `lib/tmdb.ts` et la table cache `Film`.
- **UX** : page dédiée `/series` ? Onglet Films/Séries ? Notation par épisode / saison / série ?
- **Transverse** : watchlist, tendances, profil, XP doivent intégrer les séries.

---

## G. ⚡ Performance

### G5. ✅ Streaming avec `<Suspense>`
**Fait** : pages découpées en sous-composants async avec boundaries `<Suspense>` indépendants + fallbacks skeleton (pulse `--panel`). Accueil : carrousel (`HeroSection`) et collection+stats (`CollectionSection`) streament séparément. Profil : en-tête immédiat, puis stats / films favoris / collection en 3 boundaries (la requête `filmEntries` est partagée sans duplication). Tendances : un seul boundary (agrégations déjà cachées 10 min via `unstable_cache`). Les pages restent `ƒ (Dynamic)` au build.

### G6. ✅ Images via `next/image`
**Fait** : tous les `<img>` et `background-image` de contenu (posters, avatars, carrousel, vignettes, casting, similaires) migrés vers `next/image` — `fill` + `sizes` dans les conteneurs à aspect-ratio, `width`/`height` pour les tailles fixes, `priority` sur le slide courant du carrousel et le poster de fiche film (LCP), `unoptimized` pour les previews d'upload `blob:`. Restent en CSS : backdrops flous, bannières de profil, `FilmTitleLogo` (dimensions intrinsèques variables nécessaires au repli titre). **Dette lint `no-img-element` soldée.**

**Hotfixes prod associés** (400 sur `/_next/image`) :
- `next.config.ts` n'était **pas copié** dans l'image runner du `Dockerfile` → `next start` retombait sur la config par défaut (`remotePatterns` vide). Corrigé côté Dockerfile.
- Next 16 rejette les images locales avec query string → `images.localPatterns` ajouté pour `/api/profile-media/**` et `/uploads/**` (le `?v=` des avatars).
- L'attribut `height` émis par `next/image` écrasait l'`aspect-ratio` CSS des cartes (casting, similaires, acteur) → `style={{ height: "auto" }}` sur les posters concernés.

### G7. ✅ Lectures groupées `getFilmCards()`
- Ne plus appeler `fetchFilmDetail` juste pour le `runtime` si l'info est en base (table `Film`).
- ✅ **Lecture groupée `getFilmCards()`** créée dans [lib/films.ts](lib/films.ts) — utilisée par `/api/collection` et le profil public.
- ✅ **Basculée partout** : accueil [page.tsx](app/(app)/page.tsx), profil [profile/page.tsx](app/(app)/profile/page.tsx), [trends/page.tsx](app/(app)/trends/page.tsx) (batching manuel + `setTimeout` supprimés), watchlist, favoris, listes (+ détail), amis. 1 requête DB par page, ordre et fallbacks inchangés.

### G8. ✅ Mesure — état de référence (2026-07-25)
Mesures TTFB en prod (`curl`, page servie / page en cache) :

| Page | 1er appel | En cache |
|---|---|---|
| /discover | 448 ms | **127 ms** |
| /trends | 335 ms | 190 ms |
| /film/[id] | 270 ms | 127 ms |
| /actor/[id] (rang 250 req) | 287 ms | 121 ms |
| /login (statique) | 94 ms | 94 ms |

Bundles : **JS client ~1,3 Mo** non compressé (2 gros chunks = React + framework), **CSS 130 Ko**. → tout est bon, aucun point chaud.

**Seul point structurel restant** — les caches en mémoire (`unstable_cache`, Data Cache `fetch`) sont **vidés à chaque redéploiement** ; comme on déploie souvent, la 1re visite post-deploy « repaie » les appels TMDB (le pire étant le rang acteur à 250 requêtes). Fix = **rendre les caches durables** (G2-bis + `logoUrl` en base). Non urgent (270 ms même à froid grâce au Data Cache disque tant qu'il n'est pas vidé), mais c'est le prochain gain perf logique.

- ⚠️ **Neon en veille** : palier gratuit → 1re requête après inactivité ~500 ms-1 s (cold start), non capturé par les mesures ci-dessus (site actif). Un keep-alive consommerait trop d'heures compute sur le palier gratuit → à laisser tel quel pour l'instant.
- 💡 À rapprocher de [[project_analytics]] pour des mesures côté vrais utilisateurs (Web Vitals).

### G2-bis. 🟡 Rendre les caches durables (prochain gain perf)
Les caches sont vidés à chaque déploiement. Deux tables à ajouter :
- `PersonRank { tmdbId @id, rank, updatedAt }` remplie par un **cron 1×/jour** → le rang acteur ne repaie plus les 250 requêtes.
- `logoUrl` sur la table `Film` (avec convention « pas encore vérifié » vs « vérifié, aucun logo ») → les logos de titre survivent aux redéploiements.

---

## Dette technique
- ~~**Lint désactivé en CI**~~ ✅ **Résolu** : passe de nettoyage complète (erreurs `react-hooks` — setState dans les effets, ref lu pendant le rendu — et imports/vars inutilisés), `npx eslint` à **zéro erreur/warning**, étape **Lint bloquante** réactivée dans [.github/workflows/ci.yml](.github/workflows/ci.yml) (avant typecheck + build).

## Notes techniques transverses
- Après chaque tâche : `npx tsc --noEmit` + `npx next build` en local, puis `git push`.
- Penser aux `revalidatePath` sur toutes les pages impactées (home, watchlist, profile, trends) après mutation.
- Les migrations Prisma s'appliquent **automatiquement** au démarrage du conteneur — créer la migration avec `prisma migrate diff` (hors-ligne) et la committer.

## Ordre suggéré
1. **H11** (contraste mode clair) · **H9** (nav mobile) — 🟡 gros impact ressenti
2. **H12** (logos de films dans le carrousel) — 🟡 effet « waouh »
3. **E7** (collection profil) — 🟡
4. **B2 → B3** (tri serveur + scroll infini) — 🔴 le morceau technique
5. ~~**G5 / G6** (Suspense, next/image) + passe lint~~ ✅ fait
6. **F8** (Séries) — 🔴 après brainstorm
