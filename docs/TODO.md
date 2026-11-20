# TODO — MovieTracker

Ne contient **que ce qui reste à faire**. Une tâche terminée en sort et passe dans [`HISTORIQUE.md`](HISTORIQUE.md), avec sa date.

Légende : 🟢 simple · 🟡 moyen · 🔴 gros, à cadrer · `[?]` décision de Damien attendue

---

## 🚀 Nouveaux chantiers

- [ ] 🔴 **Migrer la base Neon vers notre serveur.** PostgreSQL sur le VPS, via Coolify.
  - Plan : créer la base dans Coolify, `pg_dump` depuis Neon puis `pg_restore`, basculer `DATABASE_URL` dans Coolify, couper Neon après vérification.
  - Prévoir des **sauvegardes automatiques** (dump quotidien hors du serveur) et une **base de dev séparée**, pour que `.env.local` ne pointe plus sur la production.
  - Vérifier que `prisma migrate deploy` voit bien toutes les migrations comme appliquées.
- [ ] 🔴 **API pour relier MovieTracker à l'application d'un ami.** Depuis la fiche d'un film, MovieTracker lance directement l'application de l'ami, positionnée sur ce film.
  - À cadrer avec lui : nature de son app (web ou mobile), lien profond (URL ou schéma d'app) avec l'identifiant TMDB, échange de données éventuel dans les deux sens, authentification (jeton d'API), limites de débit.
  - Côté MovieTracker : un bouton sur la fiche film / série, et des routes d'API documentées si son app doit interroger la nôtre.
- [ ] `[?]` **Autre idée de Damien** : à compléter.

## 🎨 Produit et design

- [ ] 🟡 **Séries, suite** : listes de séries (nouveau modèle `UserSeriesList`) ; intégration anime plus poussée si besoin.
- [ ] 🟡 **Notes détaillées, suite** : exploiter `RatingDetail` (critères préférés sur le profil, recommandations). Vérifier d'abord l'enregistrement en production.
- [ ] 🟢 **`/vitals`** : seule page restée hors de la refonte Nocturne (outil interne).
- [ ] `[?]` **Notes IMDb plutôt que TMDB** (reporté) : import quotidien du jeu de données IMDb (~50-80 Mo en base) ou OMDb à la demande (1 000 requêtes par jour en gratuit).

## 🎲 Moviedle

- [ ] 🟢 Vérifier en production que `PUZZLE_BUILD_TOKEN` est défini et que le vivier est rempli (films et séries) ; le remplir sinon avec `scripts/fill-puzzle-pool.sh`.
- [ ] 💡 Partage du résultat en grille d'émojis.
- [ ] 💡 Page de statistiques : série en cours, moyenne d'essais, répartition.
- [ ] 💡 Classiques français sous le plancher de votes TMDB : seconde passe `with_origin_country=FR` pour le vivier.

## ⚡ Performance

- [ ] 🟡 **Caches durables**, aujourd'hui vidés à chaque déploiement :
  - table `PersonRank` remplie par le cron quotidien (fini les 250 requêtes TMDB par page acteur) ;
  - `logoUrl` sur la table `Film` (« pas encore vérifié » vs « vérifié, aucun logo »).

## 🔒 Infra et exploitation (hors dépôt, côté Coolify / VPS)

- [ ] 🟢 **Après le déploiement de la refonte** (commit `1ae318b`) : dans les logs Coolify, `prisma migrate deploy` doit voir `20261120120000_add_rating_detail` comme déjà appliquée ; puis tester « M'aider à noter » en production.
- [ ] 🟢 **Variables Coolify** : `CRON_SECRET`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` (+ `VAPID_SUBJECT`), et une tâche planifiée quotidienne `POST /api/cron/daily` avec `Authorization: Bearer $CRON_SECRET`. Sans elles, ni push ni passage quotidien (alertes de disponibilité, rappels).
- [ ] 🟢 **Health check Coolify** sur `/api/health` (port 3000), **puis** passage en rolling updates. Jamais l'un sans l'autre : sans health check, le rolling empile les conteneurs.
- [ ] 🟢 **Pare-feu OVH** : n'ouvrir que 80/443, plus SSH restreint (vérifier d'abord les ports avec `ss -tlnp`).
- [ ] `[?]` **CDN Cloudflare** devant movietracker.fr. Avant de basculer, adapter `clientIp()` dans `proxy.ts` (CF-Connecting-IP ou trustedIPs Traefik), sinon les limites par IP bloquent tout le monde.
- [ ] 🟢 **Moniteur de disponibilité GlitchTip** sur `/api/health` (l'uptime est activé, aucun moniteur créé).
- [ ] 🟢 **Mises à jour** : Traefik (patch) et paquets apt de l'hôte Ubuntu, dont certains demandent un redémarrage. À faire à une heure creuse.
- [ ] 🟡 **Image de base** `node:24-bookworm-slim` : vulnérabilités signalées, à traiter.
- [ ] Surveiller la tâche de nettoyage Docker de Coolify (deux échecs vers le 2026-10-23).
