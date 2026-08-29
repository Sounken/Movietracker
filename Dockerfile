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
RUN npm run build

# --- Étape runtime : image légère qui sert l'app ---
FROM node:24-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
# `next start` en mode standalone écoute sur localhost par défaut : sans ça,
# rien ne répond depuis l'extérieur du conteneur.
ENV HOSTNAME=0.0.0.0

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# Sortie `standalone` (cf. next.config.ts) : Next trace les modules réellement
# importés et n'embarque qu'eux — 45 Mo au lieu des 766 Mo de `node_modules`,
# qui trimballaient les binaires SWC et les moteurs Prisma de toutes les
# plateformes ainsi que l'outillage de développement. Le `server.js` généré
# embarque la configuration, `next.config.ts` n'a donc plus à être copié.
COPY --from=build /app/.next/standalone ./
# `standalone` ne couvre volontairement ni les assets statiques ni public/ :
# ils sont servis tels quels et doivent être copiés à côté.
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public

# Le CLI Prisma n'est pas tracé par Next (il ne sert qu'au démarrage, pas à
# l'app) : on le copie entier plutôt que de cibler ses dépendances une par une,
# pour ne pas se retrouver avec un `migrate deploy` cassé au prochain bump.
COPY --from=build /app/node_modules/prisma ./node_modules/prisma
COPY --from=build /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=build /app/node_modules/.bin/prisma ./node_modules/.bin/prisma
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/prisma.config.ts ./prisma.config.ts
COPY --from=build /app/package.json ./package.json

EXPOSE 3000
# Applique les migrations Prisma (DATABASE_URL fourni par Coolify) puis démarre
# le serveur standalone. `npm run start` n'a plus lieu d'être : le point
# d'entrée est le server.js généré, à la racine de la sortie standalone.
CMD ["sh", "-c", "./node_modules/.bin/prisma migrate deploy && node server.js"]
