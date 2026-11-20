# MovieTracker

Application Next.js (App Router, Prisma/Postgres, TMDB) de suivi de films et de séries, en français.

## Avant toute modification d'interface

Lire **`docs/DESIGN.md`** : charte graphique « Nocturne », règles de design tirées des retours de Damien, méthode de travail. Ses règles s'appliquent sans qu'on les redemande. Les plus importantes :

- **Retrait égal dans les coins** d'un conteneur arrondi : même distance du bord horizontal et du bord vertical (24px dans le hero, 16px sur mobile). Vérifier par mesure.
- **Une seule verticale** : marge latérale de 36px commune à l'en-tête et au contenu.
- **Ne pas changer la police d'un texte existant** lors d'un restyle. Les chiffres de stats sont en New Kansas, les libellés en Geist Mono capitales.
- **Ne rien retirer de la production** sans le dire : note TMDB, ROI, couleurs des recettes, note perso, libellés établis.
- **Note perso** à côté de l'année ou du genre, jamais en pastille voyante sur l'affiche.
- Utiliser « • » et non « · » dans les textes en Blauer Nue.

Ajouter dans `docs/DESIGN.md` tout nouveau retour de design qui vaut au-delà d'une page.

## Suivi des tâches

`docs/TODO.md` ne contient que ce qui reste à faire. Une tâche terminée en sort et passe dans `docs/HISTORIQUE.md`, avec sa date.

## Garde-fous

- Ne jamais commit ni push sans demande explicite : pousser `main`, c'est mettre en production (Coolify), et Damien fait une longue review avant.
- `.env.local` pointe sur la **base de production** (Neon). Demander avant toute migration (privilégier les migrations additives) et n'écrire aucune donnée de test.
- Après `prisma generate`, redémarrer le serveur de dev.
