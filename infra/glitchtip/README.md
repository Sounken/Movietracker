# GlitchTip — déploiement

Suivi des erreurs, des temps de réponse, de la disponibilité et des logs, sur
notre propre serveur. Choisi plutôt que Sentry self-hosted, qui réclame 16 Go de
RAM et 16 Go de swap là où GlitchTip tient dans 512 Mo à 1 Go.

## 1. Préparer les variables

Générer les deux secrets :

```
openssl rand -hex 32   # SECRET_KEY
openssl rand -hex 24   # POSTGRES_PASSWORD
```

Dans Coolify, créer une ressource **Docker Compose**, coller `compose.yml`, puis
renseigner ces variables d'environnement :

| Variable | Valeur |
|---|---|
| `SECRET_KEY` | la première sortie d'`openssl` |
| `POSTGRES_PASSWORD` | la seconde |
| `GLITCHTIP_DOMAIN` | `https://errors.movietracker.fr` — **avec le schéma** |
| `DEFAULT_FROM_EMAIL` | l'adresse d'expédition des alertes |
| `EMAIL_URL` | `smtp://utilisateur:motdepasse@serveur:587`, ou `consolemail://` pour commencer sans e-mail |

`GLITCHTIP_DOMAIN` sans le `https://` casse la génération des liens dans les
notifications : c'est l'erreur classique.

## 2. Domaine

Faire pointer `errors.movietracker.fr` sur le VPS, puis assigner ce domaine au
service `web` (port 8000) dans Coolify, qui s'occupe du certificat.

Le compose utilise `expose` et non `ports`, contrairement à l'exemple officiel
qui suppose une machine dédiée : le port 8000 est déjà occupé sur ce VPS, et le
déploiement échouait sur `Bind for 0.0.0.0:8000 failed: port is already
allocated`.

C'est de toute façon la bonne configuration ici. Le proxy de Coolify joint le
conteneur par le réseau Docker interne et porte le certificat ; publier le port
exposerait GlitchTip en HTTP clair sur l'IP publique, en contournant TLS.

Pour savoir ce qui occupe un port sur le VPS :

```
docker ps --format '{{.Names}}\t{{.Ports}}' | grep 8000
```

## 3. Premier démarrage

Le conteneur applique ses migrations tout seul. Une fois en ligne :

1. dans Coolify, passer `ENABLE_USER_REGISTRATION` et `ENABLE_ORGANIZATION_CREATION`
   à `True`, redéployer, créer le compte, puis les repasser à `False` et
   redéployer. Les laisser ouverts exposerait l'instance à l'inscription de
   n'importe qui ;
2. créer l'organisation et le projet `movietracker` ;
3. relever le **DSN** du projet, à reporter dans la variable `SENTRY_DSN` de
   MovieTracker.

## 4. Brancher le MCP

`GLITCHTIP_ENABLE_MCP` est déjà à `True`. Le serveur répond sur
`https://errors.movietracker.fr/mcp`, avec deux modes d'authentification :
OAuth 2.0 à enregistrement dynamique, ou un jeton d'API statique.

Il expose 17 outils : consultation et résolution d'incidents, analyse des
transactions et des spans, détection de N+1, règles d'alerte, surveillance de
disponibilité, recherche dans les logs.

Concrètement, ça permet d'aller lire les erreurs de production directement
depuis Claude Code au lieu de copier-coller des logs.

## 5. Variables côté MovieTracker

À renseigner dans Coolify, sur la ressource MovieTracker :

| Variable | Rôle | Obligatoire |
|---|---|---|
| `NEXT_PUBLIC_SENTRY_DSN` | DSN du projet GlitchTip. Sans lui le SDK reste inerte, rien n'est envoyé. | oui |
| `NEXT_PUBLIC_SENTRY_TRACES_RATE` | Part des requêtes tracées, `0.2` par défaut. | non |
| `NEXT_PUBLIC_COMMIT_SHA` | Relie une erreur au commit qui l'a introduite. | non |
| `SENTRY_URL` | `https://errors.movietracker.fr`, pour l'envoi des source maps au build. | non |
| `SENTRY_ORG` / `SENTRY_PROJECT` | Identifiants dans GlitchTip. | non |
| `SENTRY_AUTH_TOKEN` | Jeton d'API GlitchTip. **Son absence désactive proprement l'envoi des source maps**, le build passe quand même. | non |

Le DSN est public par construction — il finit dans le bundle client, c'est une
adresse d'envoi et non un secret. Le jeton d'API, lui, ne doit pas fuiter.

Sans `SENTRY_AUTH_TOKEN`, les erreurs remontent quand même, mais les piles
d'appel pointeront vers du code minifié.

## Vérifications après déploiement

```
docker stats --no-stream          # doit rester sous ~1,5 Go pour les trois services
docker compose logs web --tail 50
curl -I https://errors.movietracker.fr
```

## Ce que GlitchTip ne couvre pas

**Les Core Web Vitals** — LCP, INP, CLS. GlitchTip s'arrête aux transactions
côté serveur. Le suivi des performances perçues côté navigateur est assuré par
un collecteur maison dans MovieTracker, qui écrit dans la base de l'application.

Pas de session replay non plus, c'est un choix assumé du projet.

## Réduire encore l'empreinte

Si la mémoire devient un sujet, le compose officiel documente trois leviers, par
ordre de coût décroissant :

- `VALKEY_URL: ""` — supprime Valkey, Postgres prend la file de tâches et le cache
- `GLITCHTIP_ENABLE_LOGS: "False"`
- `GLITCHTIP_ENABLE_UPTIME: "False"`

Cible annoncée avec ces trois réglages : 256 à 512 Mo.
