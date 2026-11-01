/**
 * Régulateur de tous les appels à TMDB.
 *
 * TMDB plafonne autour de 50 requêtes par seconde et 20 connexions simultanées
 * par adresse IP — la nôtre, partagée par tous les visiteurs. Une fiche film
 * en coûte une douzaine : un robot qui en charge douze dans la même seconde
 * (constaté à répétition en novembre 2026, ~1 700 erreurs 429 en deux mois)
 * suffit à dépasser la limite, et les visiteurs présents au même moment
 * voient leur fiche échouer avec lui.
 *
 * Ici, au-delà du débit, les requêtes attendent leur tour au lieu de partir
 * pour se faire refuser. Le débit retenu laisse une marge sous la limite de
 * TMDB : les réponses servies par le cache de `fetch` consomment aussi un
 * jeton, on ne sait pas les distinguer avant l'appel.
 *
 * État en mémoire du processus, comme les compteurs du proxy : suffisant tant
 * qu'un seul conteneur sert l'application.
 *
 * Pas de `server-only` : `lib/tmdb.ts` est aussi importé par des composants
 * clients pour ses constantes (genres, plateformes). Le module y est inerte —
 * rien ne l'appelle côté navigateur — et ne contient aucun secret.
 */
const RATE_PER_SECOND = 35;
const MAX_CONCURRENT = 16;

/**
 * File d'attente bornée : sous une rafale énorme, mieux vaut refuser tout de
 * suite que laisser des centaines de rendus attendre en mémoire.
 */
const MAX_QUEUED = 400;

let tokens = RATE_PER_SECOND;
let lastRefill = Date.now();
let active = 0;
let timer: ReturnType<typeof setTimeout> | null = null;
const queue: (() => void)[] = [];

function refill() {
  const now = Date.now();
  tokens = Math.min(RATE_PER_SECOND, tokens + ((now - lastRefill) / 1000) * RATE_PER_SECOND);
  lastRefill = now;
}

function pump() {
  refill();
  while (queue.length > 0 && active < MAX_CONCURRENT && tokens >= 1) {
    tokens -= 1;
    active++;
    queue.shift()!();
  }
  // Bloqué par le débit : on se réveille quand le prochain jeton est là.
  // Bloqué par la concurrence : la fin d'une requête relancera la pompe.
  if (queue.length > 0 && tokens < 1 && !timer) {
    const wait = Math.ceil(((1 - tokens) / RATE_PER_SECOND) * 1000);
    timer = setTimeout(() => {
      timer = null;
      pump();
    }, Math.max(wait, 5));
  }
}

/** `fetch` régulé, à utiliser pour toute requête vers api.themoviedb.org. */
export async function tmdbFetch(input: string, init?: RequestInit): Promise<Response> {
  if (queue.length >= MAX_QUEUED) {
    throw new Error("TMDB saturé : file d'attente pleine");
  }
  await new Promise<void>((resolve) => {
    queue.push(resolve);
    pump();
  });
  try {
    return await fetch(input, init);
  } finally {
    active--;
    pump();
  }
}
