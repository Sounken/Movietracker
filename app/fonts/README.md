# Polices auto-hébergées

| Fichier | Police | Rôle | Fonderie |
|---|---|---|---|
| `new-kansas-black.woff2` | New Kansas Black | titres (`--font-serif`) | Newlyn Works (Miles Newlyn, Riccardo Olocco, Leo Philp) |
| `blauer-nue-regular.woff2` | Blauer Nue Regular | texte courant (`--font-sans`) | Webhance Studio (Alwin Johnson) |

Geist Mono reste chargée depuis Google Fonts pour les chiffres du texte courant.

Les deux fichiers déclarent `fsType: 8` (*Editable embedding*), le niveau le plus
permissif de la spécification OpenType : le fichier autorise lui-même
l'intégration et la modification.

## Pourquoi auto-hébergées

Servies depuis notre domaine via `next/font/local`, elles n'ajoutent aucune
requête tierce et Next se charge du `@font-face` et du préchargement. Cooper
Black, envisagée un temps, aurait imposé un chargement depuis `use.typekit.net`
— Adobe Fonts interdit l'auto-hébergement.

## Réglages notables

### `size-adjust: 85%` sur New Kansas Black

Mesurée à 100px sur « Il était une fois dans l'Ouest », elle occupe 1459px
contre 926px pour Instrument Serif, la police de titres d'origine : elle est
**1,58× plus large**. Les tailles en dur du site avaient été calées sur une
serif fine et élancée ; reprises telles quelles, les titres débordaient.

Égaliser les largeurs demanderait 63%, ce qui écraserait la police. 85% ramène
l'encombrement à ~1,34× en préservant sa présence. **C'est le seul curseur à
bouger si les titres paraissent trop gros** : il agit d'un coup sur la
cinquantaine de déclarations `--font-serif` du site.

Le titre du carrousel descend en plus à 42px : c'est le seul du site contraint à
la fois en largeur (54% du bandeau) et en hauteur (`min-height` calée sur celle
du logo).

### `font-variant-numeric: tabular-nums` sur les nombres

Les chiffres de New Kansas sont **déjà alignés** sur la capitale, mais
proportionnels par défaut (huit largeurs différentes). La police embarque `tnum`,
activé sur les classes qui empilent des nombres — statistiques du tableau de
bord, de la collection, du profil et de la comparaison, note TMDB, résultats de
recherche, numéros de favoris, récapitulatif de l'assistant — pour que les
colonnes s'alignent.

C'est ce qui distingue New Kansas de Cooper Black, un temps envisagée : cette
dernière n'embarquait **aucune** fonctionnalité OpenType, et ses chiffres
elzéviriens (le 7 descendait à −126, le 6 montait à 635) avaient dû être
redessinés à la main dans le fichier. Ce bricolage a disparu avec elle.

### `letter-spacing: -0.015em` global

Blauer Nue est dessinée très aérée : mesurée sur les minuscules, elle laisse 79
millièmes de cadratin d'air par lettre, contre 18 pour New Kansas — **4,4× plus**.
Parti pris de fonderie assumé, mais sur des libellés d'interface courts le texte
paraissait distendu. L'approche resserrée en retire environ un quart sans nuire
à la lisibilité aux petites tailles.

Posé sur `html`, le réglage s'applique aussi aux titres et au monospace, ce qui
leur va bien — les deux sont eux aussi plutôt aérés.

## Caractères absents

Ni l'une ni l'autre ne contient **★**, que l'interface affiche comme du texte
(badges de note, filtres). La chaîne de repli est donc explicite dans
`layout.tsx` pour qu'il tombe proprement sur la police système ; le décalage
passe inaperçu pour un pictogramme.

Le point médian `·` a par ailleurs été remplacé par la puce `•` dans toute
l'interface : dans Blauer Nue, `·` est centré à 685 pour une hauteur de capitale
de 700 — dessiné en exposant, il faisait lire « 1982 ° 2h45 ».

## Licence

Blauer Nue est vendue par Webhance sur MyFonts, Creative Market, Envato Elements
et Creative Fabrica. **Les licences webfont de ces plateformes excluent
fréquemment l'usage dans une application web** : à vérifier sur la licence
détenue.
