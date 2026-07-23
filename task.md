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

---

## H. 🎨 Interface & ergonomie (nouveaux retours)

### H9. 🟡 Barre de navigation mobile — mal calibrée
Sur mobile, la barre du bas ([Sidebar.tsx](app/(app)/components/Sidebar.tsx)) pose deux problèmes opposés :
- **Non connecté** : seulement **2 icônes**, et elles sont **trop petites** → ça fait vide et peu lisible.
- **Connecté** : **trop d'icônes** entassées → illisible.

**Pistes à trancher :**
- Agrandir les icônes + libellés (cibles tactiles ≥ 44 px).
- **Non connecté** : enrichir avec les entrées pertinentes (Découvrir, Tendances, Se connecter) pour remplir la barre.
- **Connecté** : limiter à 4-5 entrées principales + un bouton **« Plus »** ouvrant un menu (ou un onglet Profil regroupant les entrées secondaires).
- Vérifier les `authOnly` des items de nav ([Sidebar.tsx:66](app/(app)/components/Sidebar.tsx#L66)).

### H11. 🟡 Mode clair — contraste insuffisant
Le thème clair manque de contraste, certains textes sont difficiles à lire.

**À faire :**
- Auditer les variables de couleur du thème clair (fichiers CSS globaux / `*.module.css`).
- Viser les ratios **WCAG AA** (≥ 4.5:1 pour le texte courant, ≥ 3:1 pour le texte large).
- Vérifier en priorité : textes secondaires/atténués, libellés de stats, placeholders, bordures de cartes.

### H12. 🟡 Carrousel : afficher le **logo du film** au lieu du titre texte
TMDB fournit les **logos officiels** des films (endpoint `/movie/{id}/images` → tableau `logos`, avec langue `iso_639_1`). Remplacer le titre stylisé du carrousel (`HeroCarousel … .title`) par le logo du film, qui contient déjà le titre.

**À faire :**
- Étendre [lib/tmdb.ts](lib/tmdb.ts) : `fetchFilmLogo(id)` → choisir le logo en **fr**, sinon **en**, sinon sans langue ; renvoyer `null` si aucun.
- **Garde-fous demandés** :
  - **`max-height` stricte** sur le logo (et `max-width`) pour qu'il ne déborde jamais.
  - **Fallback sur le titre texte** si : aucun logo, format/ratio inadapté (logo trop haut/étroit), ou image en erreur.
- 💡 Synergie : stocker `logoUrl` dans la table cache `Film` (déjà créée en G1) pour éviter un appel TMDB par affichage.

---

## B. Listes de films — tri, pagination, scroll

### B2. 🔴 Bug : le tri (note / année) ne porte que sur les films déjà chargés
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

### B3. 🟡 Scroll infini (remplacer les boutons « Charger la suite »)
Bouton manuel aujourd'hui ([CollectionClient.tsx:140-148](app/(app)/components/CollectionClient.tsx#L140), [FilmGridInfinite.tsx](app/(app)/components/FilmGridInfinite.tsx)).

**À faire :** charger la page suivante au scroll via `IntersectionObserver` (sentinelle en bas de liste), fallback bouton pour l'accessibilité. À appliquer à `CollectionClient`, `FilmGridInfinite` et `DiscoverGrid`.

> À faire **après / avec B2**.

---

## E. Profil

### E7. 🟡 « Ma collection » du profil = films notés + filtre Watchlist
Le profil affiche tous les films « touchés » y compris la watchlist ([profile/page.tsx:79-81](app/(app)/profile/page.tsx#L79), `type="all"`).

**À faire :**
- Restreindre la collection du profil aux **films notés** (`rating !== null`), comme l'accueil.
- Ajouter un **bouton « Watchlist »** à côté de `Récents / Notes / Année` ([CollectionClient.tsx:117-127](app/(app)/components/CollectionClient.tsx#L117)) pour n'afficher que les films en watchlist (l'API supporte déjà `type=watchlist`).

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

## G. ⚡ Performance — reste à faire

### G5. 🟡 Streaming avec `<Suspense>`
Les pages attendent tous les fetch avant de rendre. Envelopper les sections lourdes (carrousel, collection, stats, classements) dans `<Suspense>` → affichage immédiat puis remplissage progressif.

### G6. 🟢 Images via `next/image`
`next.config.ts` autorise déjà `image.tmdb.org`. Remplacer les `<img>` / `background-image` bruts (posters, carrousel, avatars) par `next/image` → meilleur LCP, moins de bande passante. **Nettoie aussi une partie de la dette lint.**

### G7. 🟢 Divers
- Ne plus appeler `fetchFilmDetail` juste pour le `runtime` si l'info est en base (table `Film`).
- ✅ **Lecture groupée `getFilmCards()`** créée dans [lib/films.ts](lib/films.ts) — déjà utilisée par `/api/collection` et le profil public.
- ⏳ **Reste à basculer sur `getFilmCards()`** (aujourd'hui encore 1 requête par film) : accueil [page.tsx](app/(app)/page.tsx), profil [profile/page.tsx](app/(app)/profile/page.tsx), [trends/page.tsx](app/(app)/trends/page.tsx), watchlist, favoris, listes, amis.

### G8. 🟢 Mesurer
- Base de mesure (Lighthouse + timings serveur) avant/après. À rapprocher de [[project_analytics]].
- ⚠️ **Neon en veille** : palier gratuit → 1re requête ~1 s (cold start). Keep-alive/cron si gênant.

### G2-bis. 🟡 Rendre le classement acteur durable (optionnel)
Le cache actuel (`unstable_cache` 24 h) est **vidé à chaque redéploiement** → une visite « paie » alors les 250 requêtes. Version durable : table `PersonRank { tmdbId @id, rank, updatedAt }` remplie par un **cron 1×/jour**.

---

## Dette technique
- **Lint désactivé en CI** : le code a des erreurs/warnings pré-existants (`<img>`, imports non utilisés, patterns React). Faire une **passe de nettoyage**, puis **réactiver le lint** dans [.github/workflows/ci.yml](.github/workflows/ci.yml). G6 en règle une partie.

## Notes techniques transverses
- Après chaque tâche : `npx tsc --noEmit` + `npx next build` en local, puis `git push`.
- Penser aux `revalidatePath` sur toutes les pages impactées (home, watchlist, profile, trends) après mutation.
- Les migrations Prisma s'appliquent **automatiquement** au démarrage du conteneur — créer la migration avec `prisma migrate diff` (hors-ligne) et la committer.

## Ordre suggéré
1. **H11** (contraste mode clair) · **H9** (nav mobile) — 🟡 gros impact ressenti
2. **H12** (logos de films dans le carrousel) — 🟡 effet « waouh »
3. **E7** (collection profil) — 🟡
4. **B2 → B3** (tri serveur + scroll infini) — 🔴 le morceau technique
5. **G5 / G6** (Suspense, next/image) + passe lint — 🟡
6. **F8** (Séries) — 🔴 après brainstorm
