/**
 * Réglages communs aux trois environnements d'exécution (navigateur, serveur,
 * edge). Ils vivent ici pour qu'un changement de taux d'échantillonnage ou de
 * filtre ne soit pas à répercuter dans trois fichiers.
 *
 * La destination n'est pas Sentry mais notre instance GlitchTip : elle accepte
 * les mêmes SDK et le même format de DSN, ce qui permet d'utiliser
 * `@sentry/nextjs` tel quel.
 */

/**
 * Le DSN est public par construction — il finit dans le bundle client, c'est
 * une adresse d'envoi, pas un secret. Sans lui, le SDK reste inerte : c'est ce
 * qui évite d'avoir à conditionner l'initialisation partout.
 */
export const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

/**
 * En développement on n'envoie rien, sauf demande explicite : sans ça, chaque
 * rechargement à chaud pollue les incidents de production avec des erreurs
 * qu'on est en train de corriger.
 */
export const enabled =
  Boolean(dsn) &&
  (process.env.NODE_ENV === "production" || process.env.NEXT_PUBLIC_SENTRY_DEBUG === "1");

/**
 * 20% des requêtes tracées. L'auto-hébergement supprime la contrainte de quota,
 * mais pas celle du disque : chaque transaction stocke ses spans, et le VPS
 * vient de passer trois jours à saturation. 20% suffit à voir les tendances de
 * temps de réponse sans accumuler.
 */
export const tracesSampleRate = Number(process.env.NEXT_PUBLIC_SENTRY_TRACES_RATE ?? 0.2);

/** Repris tel quel dans les trois configurations. */
export const commonOptions = {
  dsn,
  enabled,
  tracesSampleRate,
  // Le nom de la release relie une erreur au commit qui l'a introduite. Coolify
  // expose le SHA ; à défaut, on laisse le SDK se débrouiller.
  release: process.env.NEXT_PUBLIC_COMMIT_SHA,
  environment: process.env.NODE_ENV,
  /**
   * Bruit de fond qui n'apprend rien et noie les vraies erreurs :
   * - les extensions de navigateur, qui lèvent depuis leur propre contexte ;
   * - les requêtes annulées, normales quand l'utilisateur navigue vite ;
   * - les erreurs de chargement de chunk, qui surviennent quand un déploiement
   *   remplace les fichiers pendant qu'un onglet est resté ouvert.
   */
  ignoreErrors: [
    "top.GLOBALS",
    "ResizeObserver loop limit exceeded",
    "ResizeObserver loop completed with undelivered notifications",
    "AbortError",
    "The operation was aborted",
    "Failed to fetch",
    "NetworkError when attempting to fetch resource",
    "Loading chunk",
    "ChunkLoadError",
  ],
  denyUrls: [
    /extensions\//i,
    /^chrome:\/\//i,
    /^chrome-extension:\/\//i,
    /^moz-extension:\/\//i,
    /^safari-web-extension:\/\//i,
  ],
};
