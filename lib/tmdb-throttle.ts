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
 * TMDB.
 *
 * **Seuls les vrais appels réseau passent par la file.** Les réponses déjà en
 * cache sont servies avant elle (cf. `tmdbFetch`). Ce n'était pas le cas : le
 * cache vivait à l'intérieur de `fetch`, donc *après* la file, et chaque
 * réponse servie de mémoire attendait quand même son jeton. Une page
 * « Découvrir » anonyme en consomme une vingtaine (liste, sorties, un logo par
 * film du carrousel) : à 35 jetons par seconde, le site plafonnait vers deux
 * pages par seconde alors que tout était en cache, et sous une rafale la file
 * portait le temps de réponse à 40 s.
 *
 * État en mémoire du processus, comme les compteurs du proxy : suffisant tant
 * qu'un seul conteneur sert l'application.
 *
 * Pas de `server-only` : `lib/tmdb.ts` est aussi importé par des composants
 * clients pour ses constantes (genres, plateformes). Le module y est inerte —
 * rien ne l'appelle côté navigateur — et ne contient aucun secret.
 */
import { unstable_cache } from "next/cache";

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

/** Appel réseau, après avoir obtenu un jeton. */
async function throttledFetch(input: string, init?: RequestInit): Promise<Response> {
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

/** Réponse mise en cache : statut et corps, seuls éléments lus par les appelants. */
type CachedResponse = { status: number; body: string };

/**
 * Réponse à ne pas garder : saturation (429) ou panne de TMDB (5xx). La lever
 * empêche `unstable_cache` de la conserver ; elle est rendue telle quelle à
 * l'appelant, qui lit encore son `Retry-After` pour réessayer.
 */
class TransientTmdbResponse extends Error {
  constructor(readonly response: Response) {
    super(`TMDB a répondu ${response.status}`);
  }
}

/**
 * `fetch` régulé et mis en cache, à utiliser pour toute requête vers
 * api.themoviedb.org.
 *
 * Avec `next.revalidate`, la réponse est gardée par `unstable_cache` (même
 * stockage que le cache de `fetch` : en mémoire, borné par
 * `cacheMaxMemorySize`) et une réponse présente ne touche jamais la file. Une
 * entrée expirée est encore servie pendant que sa remplaçante se charge en
 * arrière-plan : sous une rafale, on sert du périmé plutôt que d'attendre.
 *
 * L'appel réseau lui-même part en `no-store` : sans quoi le cache de `fetch`
 * garderait une seconde copie de chaque réponse.
 */
export async function tmdbFetch(input: string, init?: RequestInit): Promise<Response> {
  const revalidate = init?.next?.revalidate;
  if (typeof revalidate !== "number" || revalidate <= 0) return throttledFetch(input, init);

  try {
    const cached = await unstable_cache(
      async (): Promise<CachedResponse> => {
        const res = await throttledFetch(input, { ...init, next: undefined, cache: "no-store" });
        if (res.status === 429 || res.status >= 500) throw new TransientTmdbResponse(res);
        return { status: res.status, body: await res.text() };
      },
      ["tmdb", input],
      { revalidate },
    )();
    return new Response(cached.body, {
      status: cached.status,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    if (err instanceof TransientTmdbResponse) return err.response;
    throw err;
  }
}
