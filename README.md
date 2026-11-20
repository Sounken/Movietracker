# MovieTracker

Journal de films et de séries en français ([movietracker.fr](https://movietracker.fr)). On y note, suit et découvre des œuvres, on compare ses goûts avec ses amis, on tient son journal et on joue au Moviedle.

## Stack

- **Next.js 16** (App Router, Server Components, Server Actions), React 19, TypeScript
- **Prisma 7** sur PostgreSQL (Neon)
- **TMDB** pour le catalogue ; Wikidata pour les distinctions ; JustWatch (via TMDB) pour « Où regarder »
- **Vercel Blob** pour les avatars et bannières, **Resend** pour les e-mails, **Web Push** pour les notifications
- **GlitchTip** (compatible Sentry) pour le suivi des erreurs : les variables `SENTRY_*` pointent vers GlitchTip

## Démarrer en local

```bash
npm install
npx prisma generate
npm run dev        # http://localhost:3000
```

Les variables vivent dans `.env.local` (jamais commité). Indispensables : `DATABASE_URL`, `SESSION_SECRET`, `TMDB_API_KEY`. Les autres (Blob, Resend, VAPID, `SENTRY_*`, `CRON_SECRET`…) activent chacune une fonctionnalité.

> ⚠️ Aujourd'hui, `.env.local` pointe sur la **base de production**. Toute migration ou écriture faite en local touche la production : demander avant.

Après un `prisma generate`, redémarrer le serveur de dev (il garde l'ancien client en mémoire).

## Scripts

| Commande | Rôle |
|---|---|
| `npm run dev` | Serveur de développement |
| `npm run build` | `prisma generate` + build de production |
| `npm run start` | Serveur de production |
| `npm run lint` | ESLint |
| `npx tsc --noEmit` | Vérification des types |
| `scripts/fill-puzzle-pool.sh` | Remplit le vivier du Moviedle, page par page |

## Arborescence

```
app/
  (app)/            Pages avec le cadre de l'application (en-tête, barre du bas mobile)
    components/     Composants partagés : AppTopbar, grilles, collection, home/ (briques des accueils)
    films/ series/  Mondes Films et Séries
  (standalone)/     Fiches film, série, acteur, société
    components/     Composants des fiches : sheet/ (hero, note, onglets, cartes), où regarder, bande-annonce…
  (auth)/           Connexion, inscription, mot de passe
  actions/          Server Actions (notes, listes, journal, amis…)
  api/              Routes HTTP (collection, recherche, cron, push…)
  generated/prisma/ Client Prisma généré (ignoré par git)
lib/                Logique métier et accès aux services (TMDB, notes, stats, journal…)
prisma/             Schéma et migrations
docs/               DESIGN.md (charte), TODO.md (à faire), HISTORIQUE.md (fait), présentations
infra/              Déploiement de GlitchTip
scripts/            Scripts d'exploitation
```

## Design

Toute modification d'interface suit **[`docs/DESIGN.md`](docs/DESIGN.md)** : charte « Nocturne », règles de design et méthode de travail. Les agents commencent par [`CLAUDE.md`](CLAUDE.md).

## Déploiement

Un push sur `main` déclenche le CI GitHub Actions (lint, types, build), puis Coolify redéploie le conteneur. Au démarrage, celui-ci applique `prisma migrate deploy`. Pousser `main`, c'est donc **mettre en production**.
