# syntax=docker/dockerfile:1

# --- Étape build : compile l'app Next.js + génère le client Prisma ---
FROM node:24-bookworm-slim AS build
WORKDIR /app

# openssl est requis par Prisma
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# Installe toutes les dépendances (y compris dev, nécessaires au build)
COPY package.json package-lock.json ./
RUN npm ci

# Copie le code et build (le script "build" lance `prisma generate && next build`)
COPY . .

# --- Variables nécessaires *au build*, pas au runtime ---
#
# Next remplace les `process.env.NEXT_PUBLIC_*` par leur valeur au moment de la
# compilation : absentes ici, elles valent `undefined` dans le bundle client,
# quoi qu'on renseigne ensuite côté Coolify.
#
# En pratique Coolify les transmet déjà — le DSN est bien présent dans le bundle
# en production, c'est vérifié. Ces déclarations ne corrigent donc pas un défaut,
# elles rendent la dépendance explicite : un `docker build` lancé à la main, en
# CI ou sur une autre plateforme produit aujourd'hui une image sans supervision,
# silencieusement. Et c'est ce qui manque à `SENTRY_AUTH_TOKEN` pour que l'envoi
# des source maps fonctionne, lui aussi consommé au build.
ARG NEXT_PUBLIC_SENTRY_DSN
ARG NEXT_PUBLIC_SENTRY_TRACES_RATE
ARG NEXT_PUBLIC_COMMIT_SHA
ENV NEXT_PUBLIC_SENTRY_DSN=$NEXT_PUBLIC_SENTRY_DSN \
    NEXT_PUBLIC_SENTRY_TRACES_RATE=$NEXT_PUBLIC_SENTRY_TRACES_RATE \
    NEXT_PUBLIC_COMMIT_SHA=$NEXT_PUBLIC_COMMIT_SHA

# Le jeton et les coordonnées de l'instance servent à `sentry-cli` pendant
# `next build`. Un `ARG` suffit : Docker expose les arguments de construction
# comme variables d'environnement aux instructions `RUN`, et l'étape `runner`
# étant distincte, rien de tout cela n'atteint l'image finale.
#
# L'absence de jeton n'échoue pas le build — `next.config.ts` désactive alors
# proprement l'envoi des source maps.
ARG SENTRY_AUTH_TOKEN
ARG SENTRY_URL
ARG SENTRY_ORG
ARG SENTRY_PROJECT

RUN npm run build

# --- Étape runtime : image légère qui sert l'app ---
FROM node:24-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# Récupère le résultat du build
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/prisma.config.ts ./prisma.config.ts
COPY --from=build /app/package.json ./package.json
# Requis au runtime : `next start` recharge la config (images.remotePatterns…)
# et retombe sur les valeurs par défaut si le fichier est absent.
COPY --from=build /app/next.config.ts ./next.config.ts
# `images.loaderFile` est vérifié sur le disque à chaque démarrage, pas
# seulement au build : Next lève `Specified images.loaderFile does not exist`
# et le conteneur meurt en boucle si `lib/` n'est pas là. Le code du loader est
# certes déjà compilé dans `.next`, mais la config relue au runtime exige que
# le fichier source existe encore.
COPY --from=build /app/lib ./lib

EXPOSE 3000
# Applique les migrations Prisma (DATABASE_URL fourni par Coolify) puis démarre l'app.
CMD ["sh", "-c", "npx prisma migrate deploy && npm run start"]
