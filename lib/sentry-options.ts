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
export const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN || undefined;

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
 *
 * La valeur est validée plutôt que convertie à l'aveugle. `?? 0.2` ne
 * protégeait que de `undefined` : un `ARG` Docker déclaré mais non transmis
 * arrive en **chaîne vide**, et `Number("")` vaut `0` — le tracing se serait
 * coupé sans que rien ne le signale. Une valeur mal saisie donnerait `NaN`,
 * avec le même silence. On retombe sur le défaut dans les deux cas.
 */
const rawTracesRate = Number(process.env.NEXT_PUBLIC_SENTRY_TRACES_RATE);
export const tracesSampleRate =
  Number.isFinite(rawTracesRate) && rawTracesRate >= 0 && rawTracesRate <= 1 ? rawTracesRate : 0.2;

/** Repris tel quel dans les trois configurations. */
export const commonOptions = {
  dsn,
  enabled,
  tracesSampleRate,
  // Le nom de la release relie une erreur au commit qui l'a introduite. Coolify
  // expose le SHA ; à défaut, on laisse le SDK se débrouiller. `|| undefined`
  // pour la même raison que le DSN : une chaîne vide créerait une release sans
  // nom plutôt que de laisser le SDK détecter la sienne.
  release: process.env.NEXT_PUBLIC_COMMIT_SHA || undefined,
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

    /**
     * Message exact `aborted`, levé par `abortIncoming` de Node quand le client
     * ferme la connexion avant que le serveur ait fini de lire la requête.
     * Normal au déchargement d'une page — c'est le cas des envois par
     * `sendBeacon`, qui coupent sans attendre la réponse.
     *
     * Ancré par une expression régulière plutôt qu'en sous-chaîne : `"aborted"`
     * en texte libre écarterait aussi toute erreur applicative dont le message
     * contient le mot.
     */
    /^aborted$/,

    /**
     * Onglet resté ouvert pendant un redéploiement : l'identifiant de la Server
     * Action postée n'existe plus dans le nouveau bundle. Même famille que
     * `ChunkLoadError` ci-dessus, et pas davantage un défaut du code — la
     * réponse est de recharger, ce que fait la frontière d'erreur.
     *
     * **Next émet deux messages distincts pour cette même situation**, et le
     * premier filtre n'en couvrait qu'un. Le second est apparu dès le
     * déploiement suivant, sous le type `UnrecognizedActionError` :
     *
     *   Server Action "708a878d53…" was not found on the server.
     *
     * Il porte l'identifiant de l'action **dans le message**, donc chaque
     * action périmée crée son propre incident — exactement le travers qui avait
     * produit seize incidents TMDB pour deux causes. On filtre sur la partie
     * stable de la phrase, sans l'identifiant.
     */
    "Failed to find Server Action",
    "was not found on the server",
  ],
  denyUrls: [
    /extensions\//i,
    /^chrome:\/\//i,
    /^chrome-extension:\/\//i,
    /^moz-extension:\/\//i,
    /^safari-web-extension:\/\//i,
  ],

  /**
   * Le tunnel de supervision ne doit pas produire d'incidents de supervision.
   *
   * Le navigateur poste ses enveloppes au moment où la page se décharge, puis
   * coupe la connexion sans attendre la réponse ; Node lève `aborted` et
   * `onRequestError` la remonte. Quarante et une occurrences en cinq jours,
   * toutes sur `POST /api/mn`, et la boucle est vicieuse : signaler une erreur
   * peut en engendrer une autre.
   *
   * `ignoreErrors` couvre déjà le message, mais cette route ne contient aucun
   * code métier — tout ce qui s'y produit est du transport. On l'écarte donc en
   * bloc, ce qui vaut aussi pour les échecs futurs du relais lui-même : ils se
   * lisent dans les journaux du conteneur, pas ici, où ils masqueraient
   * l'application qu'on cherche à superviser.
   */
  beforeSend<T extends { transaction?: string }>(event: T): T | null {
    return event.transaction === "POST /api/mn" ? null : event;
  },

  /**
   * Les transactions passent par un crochet distinct : `beforeSend` ne filtre
   * que les erreurs, et sans celui-ci le tunnel resterait tracé.
   *
   * Les deux routes visées ne font qu'encaisser de la télémétrie — une requête
   * par événement remonté, une par lot de web vitals. À 20% d'échantillonnage,
   * elles pèsent une part notable des spans stockés sans rien dire de
   * l'expérience réelle : le temps de réponse de la route de collecte n'apprend
   * rien sur celui des pages. Autant ne pas dépenser le disque pour ça.
   *
   * À noter : `/api/vitals` n'est écartée qu'ici, pas dans `beforeSend`. Une
   * erreur qui s'y produit — un échec d'écriture en base, par exemple — est un
   * vrai défaut, et doit continuer de remonter.
   */
  beforeSendTransaction<T extends { transaction?: string }>(event: T): T | null {
    const collecte = event.transaction === "POST /api/mn" || event.transaction === "POST /api/vitals";
    return collecte ? null : event;
  },
};
