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

### H11. ✅ Mode clair — contraste corrigé
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

### F8. 🔴 Développer la partie Séries — **brainstorm requis**
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

### G8. 🟢 Mesurer
- Base de mesure (Lighthouse + timings serveur) avant/après. À rapprocher de [[project_analytics]].
- ⚠️ **Neon en veille** : palier gratuit → 1re requête ~1 s (cold start). Keep-alive/cron si gênant.

### G2-bis. 🟡 Rendre le classement acteur durable (optionnel)
Le cache actuel (`unstable_cache` 24 h) est **vidé à chaque redéploiement** → une visite « paie » alors les 250 requêtes. Version durable : table `PersonRank { tmdbId @id, rank, updatedAt }` remplie par un **cron 1×/jour**.

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
