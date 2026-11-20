# MovieTracker — charte graphique et règles de design

> **Pour qui :** tout agent (ou personne) qui modifie l'interface de MovieTracker.
> **Comment s'en servir :** lire ce document **avant** toute modification visuelle.
> Les sections 2 et 3 sont des règles à appliquer sans redemander. La section 6
> retrace d'où elles viennent. Quand Damien donne un nouveau retour de design qui
> vaut au-delà d'une seule page, l'ajouter en section 3, formulé comme une règle,
> avec la raison.

---

## 1. Direction : « Nocturne »

La salle s'éteint, l'image prend toute la place. Inspirations : MUBI, Apple TV.

- **Heroes plein cadre** : coins arrondis, en retrait de la fenêtre, avec l'en-tête posé dessus.
- **Navigation en haut de page** : plus de barre latérale sur grand écran ; elle ne sert plus que de barre du bas sur mobile.
- **Surfaces sombres** : cartes arrondies, pastilles, sur-titres dorés, titres en serif.
- **Couleurs rares et fonctionnelles** : l'orange signale ce qui est vivant ou actionnable, le doré ce qui est une note ou un sur-titre.

La direction est retenue pour la production : elle est la seule implémentée, les maquettes concurrentes (Porcelaine, Grand format) ont été supprimées.

---

## 2. Charte graphique

### 2.1 Couleurs (tokens dans `app/globals.css`)

| Token | Valeur | Usage |
|---|---|---|
| `--bg` | `#0d0b0a` | Fond de page |
| `--bg-2` | `#15110f` | Fond secondaire (hero en chargement) |
| `--panel` | `#1a1614` | Cartes, champs, menus |
| `--line` | `#2a221f` | Bordures de carte, séparateurs |
| `--ink` | `#f4ece2` | Texte principal ; fond des boutons primaires |
| `--ink-dim` | `#a59689` | Texte secondaire. **Minimum** pour un texte posé sur du verre ou une image |
| `--ink-mute` | `#5e524a` | Texte tertiaire sur fond uni seulement |
| `--accent` | `#d97742` | Orange : point « en direct », trait sous l'entrée active, survol des boutons primaires, « M'aider à noter », pastille de niveau |
| `--accent-soft` | `#f0a978` | « tracker » de la marque, sur-titre du hero, **ma note** à côté du titre |
| `--gold` | `#e8c98a` | Notes (★), sur-titres de section, chiffres d'XP, éléments sélectionnés en « doré » |
| `#7ab06a` | vert | Positif : recettes > budget, ROI positif, variations à la hausse |
| `#e06c5a` | rouge | Négatif : recettes < budget, ROI négatif |
| `--red-soft` | `#e7a39b` | Sortie, suppression, malus (sans alarmer) |

Les voiles sur image utilisent les composantes RVB (`rgba(var(--bg-rgb), 0.9)`).
Ne jamais coder une couleur en dur quand un token existe.

### 2.2 Typographie

| Police | Variable | Usage |
|---|---|---|
| **New Kansas Black** | `--font-serif` | Titres de page et de section, nom de la marque, **chiffres de stats** (films notés, moyenne, heures, scores, notes détaillées), avec `font-variant-numeric: tabular-nums` |
| **Blauer Nue** (400 seulement) | `--font-sans` | Interface et texte courant |
| **Geist Mono** | `--font-geist-mono` | Libellés de stats **en capitales** (« FILMS NOTÉS », « NOTE MOYENNE »), sur-titres (« BIBLIOTHÈQUE »), pastilles et filtres d'origine, badges de note, ligne d'infos sous les affiches |

Règles :
- **Ne jamais changer la police d'un texte existant** lors d'un restyle (cf. 3.3).
- Le ★ de New Kansas est massif : en serif, l'envelopper et le réduire à `0.6em` (`vertical-align: 0.2em`).
- Blauer Nue dessine le point médian « · » en exposant : utiliser **« • »** dans tout texte en sans-serif.
- Pas de `font-weight` intermédiaire : les fichiers n'ont qu'un poids, sinon le navigateur fabrique un faux gras.

Tailles de référence :
- titre de page 34px ;
- titre de section 26–34px ;
- texte de lecture (synopsis) **15px / 1.75** ;
- texte secondaire jamais sous 12px ;
- texte des cartes d'affiches fluide : `clamp(0.84rem, 0.78rem + 0.2vw, 0.94rem)` pour le titre, `clamp(0.72rem, 0.69rem + 0.12vw, 0.8rem)` pour les infos.

### 2.3 Marque

Logo `/logo.png` (affiché à 38px de large, `height: auto`) suivi de « Movie<em>tracker</em> » en New Kansas 27px. Le `<em>` est en italique `--accent-soft`. On garde la même marque partout : en-tête, connexion, 404.

### 2.4 Formes et espacements

| Élément | Valeur |
|---|---|
| Hero | Retrait de 12px (8px sur mobile), `--radius-lg` 28px (22px sur mobile) |
| Carte | `--panel` + `1px --line`, rayon 24px |
| Affiche | Rayon 16px (20px pour les grandes : fiche, favoris) |
| Pastille / bouton | Rayon 999px, hauteur 34–48px |
| `--radius` (générique) | 20px |
| **Marge latérale de l'app** | **36px** (16px sur mobile), commune à l'en-tête et au contenu |

### 2.5 Composants

- **Bouton primaire** : fond `--ink`, texte `--bg`. Au survol, fond `--accent`, texte blanc.
- **Bouton secondaire sur image** : liquid glass (2.6).
- **Pastille de filtre ou de tri** : contour `rgba(244,236,226,0.15)`, contour plus clair au survol. L'état actif est en `--ink` / `--bg`, ou doré pour un filtre coché.
- **Onglets segmentés** : conteneur `--panel` arrondi ; l'onglet actif est en `--ink` / `--bg`.
- **Sur-titre** : Geist Mono 12px, capitales, `letter-spacing: 0.04em`, `--gold`.
- **Carte d'affiche (grilles)** :
  - affiche à 16px de rayon, dégradé sombre sur les 45 % du bas, zoom de 4 % au survol ;
  - **note TMDB en haut à droite**, dans un badge noir translucide aux chiffres dorés (toujours présente) ;
  - **ma note à côté de l'année et du genre** (« 2019 • Aventure • ★ 9/10 », en `--accent-soft`), jamais en pastille sur l'affiche ;
  - ligne d'infos sur une seule ligne : le genre se tronque, l'année et la note restent.
- **Pastille de stat** : chiffre en serif, libellé en mono capitales, variation colorée, le tout centré verticalement (`align-items: center`).
- **« M'aider à noter »** : contour et fond orange translucides, icône étincelle. Ne plus parler de « Grille Express » : la carte s'appelle « **Notes** ».

### 2.6 Liquid glass

Tokens dans `globals.css` :

```css
background: var(--glass-sheen), var(--glass-fill);
backdrop-filter: var(--glass-blur);
-webkit-backdrop-filter: var(--glass-blur);
border: 1px solid var(--glass-edge);
box-shadow: var(--glass-shadow);
```

- **Élément actif sur du verre** (pastille Films/Séries) : `--glass-lens` et `--glass-lens-shadow`.
- **Verre qui porte du texte ou des logos** (« Aussi cette semaine », « Où regarder ») : teinter le fond de sombre (`var(--glass-sheen), rgba(var(--bg-rgb), 0.55)`) pour rester lisible.
- **Où il est appliqué** : bascule Films/Séries, boutons ronds de l'en-tête, boutons secondaires et Retour des heroes, file « Aussi cette semaine », carte « Où regarder ».

### 2.7 Mise en page

- **En-tête global** (`app/(app)/components/AppTopbar.tsx`) :
  - contenu : marque, Films/Séries, navigation (Accueil, Découvrir, Mes listes, **Amis**, Calendrier, À voir), menu « Plus » (Favoris, **Journal**, Ce soir, Tendances, Moviedle), recherche (raccourci `/`), notifications, compte ;
  - transparent en haut de page, en verre sombre au défilement.
- **Pages à hero** (`data-hero` sur la racine : accueils, fiches, profil) : l'en-tête se pose sur l'image (`app/(app)/app.module.css`).
- **Fiche film / série** :
  - hero de 600px, texte ancré à 112px du haut, affiche alignée sur le bouton Retour ;
  - colonne de l'affiche collante (à 96px), avec Ma note et Où regarder (plus de carte « Tes amis ») ;
  - onglets collants : Aperçu, Casting, Critiques, Distinctions, Similaires ;
  - Aperçu en deux colonnes : synopsis, thèmes puis **bande-annonce** à gauche, fiche technique à droite. Le journal n'est plus sur la fiche : « Vu » renvoie au Journal une fois le film vu.
- **Collection** (accueils, profil, À voir, Favoris) : grille complète à défilement infini (`CollectionClient`), jamais un rail.

### 2.8 Mouvement

Une courbe et des durées communes, dans `globals.css` : `--ease-out`, `--dur-fast` / `--dur-base`. Les animations propres à Nocturne :
- Ken Burns de 20–24s sur les backdrops ;
- fondu de 800ms entre deux films ;
- note qui « se pose » avec `--spring` ;
- glissement de la pastille Films/Séries.

Tout est désactivé par `prefers-reduced-motion`.

---

## 3. Règles universelles (les goûts de Damien)

Chaque règle vient d'un retour explicite. Les appliquer sans attendre qu'on le redemande.

### 3.1 Retrait égal dans les coins

Le contenu posé dans un conteneur arrondi est à **la même distance du bord horizontal et du bord vertical**. On mesure sur l'élément le plus haut de la rangée.

- Valeurs : 24px dans le hero sur grand écran, 16px sur mobile.
- 32px a été jugé trop bas : rester entre 16 et 24px.
- Vérifier **par mesure** (`getBoundingClientRect`), pas à l'œil.
- *Pourquoi :* un côté plus aéré que l'autre se voit immédiatement et donne une impression de désordre.

### 3.2 Une seule verticale

La marque de l'en-tête, les titres de page et le contenu commencent sur la même verticale : 36px du bord de la fenêtre, soit 24px du bord du hero sur les pages à image. Toute nouvelle page reprend cette marge.

### 3.3 Ne pas changer les polices existantes

Lors d'un restyle, on peut changer couleurs, rayons, espacements et fonds, mais **pas la police d'un texte qui existe déjà**, chiffres et libellés compris. Les chiffres de stats restent en New Kansas, les libellés en mono capitales.

*Pourquoi :* Damien a demandé deux fois de revenir aux polices d'origine.

### 3.4 Préserver ce qui existe en production

Un restyle ne retire aucune information ni fonctionnalité sans l'annoncer et le justifier. Par exemple : note TMDB sur les affiches, recettes en vert ou rouge, ROI, note perso. Les termes établis restent (« M'aider à noter »).

*Pourquoi :* plusieurs pertes ont dû être réparées après coup.

### 3.5 La note perso reste discrète

La note perso se place à côté de l'année ou du genre, comme en production, et au même endroit sur toutes les grilles (collection, Découvrir, séries). Pas de pastille pleine et voyante sur l'affiche.

### 3.6 Lisibilité sur image

- Texte posé sur une image : ombre fine (`0 1px 2px rgba(0,0,0,.8)`).
- Pas d'ombre sur les liens secondaires (« Streaming → »).
- Libellés sur verre en `--ink-dim` minimum, jamais `--ink-mute`.

### 3.7 Tailles de texte mesurées

Le texte de lecture ne dépasse pas 15–16px (un synopsis à 19px a été jugé trop gros). Texte des cartes en `clamp()`, jamais sous 12px.

### 3.8 Centrage vertical des pastilles

Dès qu'une pastille mélange des polices (serif + mono), on centre avec `align-items: center` et `line-height: 1`, jamais sur la ligne de base.

### 3.9 Pas de trou dans une mise en page à colonnes

Quand une colonne est nettement plus courte que sa voisine, par exemple un synopsis court face à une fiche technique, on y range un contenu secondaire déjà présent sur la page (la bande-annonce) plutôt que de laisser un vide. On retire les blocs peu utiles plutôt que de les empiler.

### 3.10 Pas de graphique sur un échantillon trop maigre

Un graphique de répartition ne s'appuie que sur des données assez nombreuses.
- Les notes des critiques TMDB (3 ou 4 par film) ont été retirées du graphique.
- La moyenne TMDB y reste comme simple repère.
- TMDB ne publie pas la répartition de ses votes.

### 3.11 Couleurs fonctionnelles

- Vert : positif.
- Rouge : négatif.
- Doré : notes.
- Orange : action ou « en direct ».

Ne pas décorer avec ces couleurs.

---

## 4. Méthode de travail

- **Langue** : français, y compris dans les commentaires de code, au même niveau de détail que le code existant (le « pourquoi »).
- **Git** : ne jamais commit ni push sans demande explicite. Pousser `main` = mise en production (Coolify) ; Damien fait une **longue review avant tout push**.
- **Base de données** : la base locale (`.env.local`) **est la production Neon**.
  - Demander avant toute migration, et préférer les migrations additives (nouvelle table plutôt que colonne modifiée).
  - Ne pas écrire de données de test sur le compte de Damien.
  - Le conteneur applique `prisma migrate deploy` au démarrage.
  - Après `prisma generate`, redémarrer le serveur de dev : il garde l'ancien client en mémoire.
- **Avatars et bannières** : ils ne s'affichent pas en local (stockés sur le serveur de production). C'est normal.
- **Vérification** :
  - après chaque changement visuel, capture Playwright (navigateur sous `~/.npm/_npx/.../playwright`) ;
  - session forgée localement pour le compte « Damien » (orange.fr), jeton supprimé après usage ;
  - mesures d'alignement quand c'est un sujet d'alignement ;
  - `tsc` et `eslint` propres avant d'annoncer.
- **Rythme** : pour une migration large, travailler page par page et notifier à chaque page pour vérification.

---

## 5. Fichiers clés

| Fichier | Rôle |
|---|---|
| `app/globals.css` | Tokens : couleurs, rayons, liquid glass, mouvement |
| `app/(app)/app.module.css` | Cadre : marge de 36px, règle `data-hero` |
| `app/(app)/components/AppTopbar.tsx` (+ `.module.css`) | En-tête global, menu compte, recherche |
| `app/(app)/films/home/` | Accueil Nocturne (hero, file « Aussi cette semaine », stats) — réutilisé par l'accueil Séries |
| `app/(app)/films/home-data.ts` | Données de l'accueil (hero, collection, stats) |
| `app/(standalone)/film/[id]/nocturne/` | Fiche film ; `parts.tsx` (cartes « Les notes », « Notes », rails) partagé avec la fiche série |
| `app/(standalone)/series/[id]/SeriesNocturne.tsx` | Fiche série |
| `app/actions/rating-detail.ts` + modèle `RatingDetail` | Sauvegarde des notes détaillées de « M'aider à noter » |
| `app/(app)/components/FilmGrid.*`, `films/discover/discover.module.css` | Cartes d'affiches |

---

## 6. Historique de la discussion (novembre 2026)

1. **Trois maquettes d'accueil** (Nocturne, Porcelaine, Grand format), à intégrer avec les vrais films et notre palette. Elles ont été ajoutées derrière `?design=`, avec un sélecteur flottant. → **Nocturne retenu pour la production.**
2. **Fiche film Nocturne** depuis une maquette dont seul le corps était dessiné : hero reconstruit d'après les notes de la maquette. Exigence : **garder les étoiles** pour la note.
3. **Transposition de toute l'app** :
   - Nocturne devient le seul design ; la barre latérale est remplacée par l'en-tête global ;
   - le bandeau « Bonjour, Damien » disparaît ;
   - styles communs (pastilles, cartes, grilles) ;
   - fiches série, acteur et société, puis migration page par page (profil, listes, journal, calendrier, amis, tendances, Ce soir, Moviedle, réglages, bilan, connexion, comparaison, 404).
4. **Retours, 1er lot** :
   - collection en grille à défilement infini plutôt qu'en rail ;
   - marque d'origine (logo + « Movie*tracker* ») ;
   - **retour aux polices d'origine** ;
   - note TMDB remise sur les affiches ;
   - ombre fine sur « Aussi cette semaine ».
5. **Retours, 2e lot** :
   - libellés de stats en mono capitales ;
   - pas d'ombre sur « Streaming » ;
   - **note perso à côté du titre ou du genre**, comme en production, y compris sur Découvrir ;
   - Amis dans la barre, Journal dans « Plus » ;
   - pastille Films/Séries centrée sur son libellé.
6. **Alignement** :
   - retrait égal dans le coin du hero : d'abord 32px (jugé trop bas), puis **24px** ;
   - étendu à toute l'app avec une marge commune de **36px**.
7. **Retours, 3e lot** :
   - typographie fluide sous les affiches ;
   - pastilles de stats centrées verticalement ;
   - **liquid glass** ;
   - fiche : affiche alignée sur Retour et contenu remonté, meilleur contraste pour « En abonnement / En location », synopsis ramené à 15px ;
   - « M'aider à noter » remplace « Grille Express » ;
   - **sauvegarde des notes détaillées en base** (table `RatingDetail`, migration appliquée sur Neon avec accord) ;
   - carte « Notes » ;
   - répartition des notes enrichie des notes des critiques TMDB (TMDB ne publie pas de répartition), avec un repère pour la moyenne TMDB ;
   - ROI et recettes en vert ou rouge rétablis.

8. **Retours, 4e lot, puis mise en production** :
   - carte « Tes amis » retirée de la fiche ;
   - journal retiré de la fiche, bande-annonce déplacée sous le synopsis pour combler le vide ;
   - barres des critiques TMDB retirées du graphique (échantillon trop faible) ;
   - nettoyage de la console (loader TMDB, chargement anticipé des premières affiches, logos, vignette YouTube) ;
   - build de production vérifié, puis commit et push sur `main`.

   Messages restants, propres à l'environnement local : avatar en 400 et bannière en 500 (jeton Vercel Blob absent en local), hydratation perturbée par l'extension Bitdefender (`bis_skin_checked`), préchargement CSS du serveur de dev de Next.

---

## 7. Points ouverts

- **Notes détaillées** : vérifier l'enregistrement depuis la fiche (« M'aider à noter », puis valider). Je ne l'ai pas testé moi-même pour ne pas écrire sur le compte de production.
- **Pages non migrées** : `/vitals` (outil interne).
- **Après le déploiement** : vérifier dans les logs Coolify que `prisma migrate deploy` voit `20261120120000_add_rating_detail` comme déjà appliquée.
