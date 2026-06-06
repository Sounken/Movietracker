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

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# Récupère le résultat du build
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/package.json ./package.json

EXPOSE 3000
CMD ["npm", "run", "start"]
