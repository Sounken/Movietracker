/**
 * Initialisation côté navigateur. Next charge ce fichier avant le code de
 * l'application, ce qui permet de capturer les erreurs survenues pendant
 * l'hydratation — les plus pénibles à reproduire autrement.
 */
import * as Sentry from "@sentry/nextjs";
import { commonOptions, enabled } from "@/lib/sentry-options";

/**
 * Surtout ne pas passer `integrations` ici.
 *
 * Fourni sous forme de tableau, le champ **remplace** les intégrations par
 * défaut au lieu de s'y ajouter. Un `integrations: []` — écrit pour écarter le
 * session replay — supprimait du même coup `globalHandlers`, qui accroche
 * `window.onerror` et capture les erreurs non gérées, ainsi que
 * `inboundFilters`, qui applique `ignoreErrors` et `denyUrls`. Le SDK
 * s'initialisait correctement, DSN compris, et n'envoyait jamais rien : aucune
 * requête réseau, aucun message d'erreur.
 *
 * La précaution était doublement inutile : le session replay ne fait pas partie
 * des défauts, il faut l'ajouter explicitement via `replayIntegration()`. Ne
 * rien déclarer est donc exactement ce qu'on veut.
 *
 * Pour retirer une intégration précise sans perdre les autres, il faut passer
 * une fonction : `integrations: (defauts) => defauts.filter(…)`.
 */
Sentry.init({
  ...commonOptions,
  /**
   * Les événements transitent par notre propre route plutôt que d'aller
   * directement à GlitchTip : les bloqueurs de publicité filtrent le motif
   * `/api/<id>/envelope/?sentry_key=…` quel que soit le domaine, et toutes les
   * erreurs des utilisateurs équipés d'un bloqueur étaient perdues.
   *
   * `tunnel` est une option d'exécution du SDK, contrairement à `tunnelRoute`
   * qui passe par le greffon webpack et que Turbopack ignore.
   */
  tunnel: "/api/mn",
});

/** Nécessaire pour que les transitions de route apparaissent dans les traces. */
export const onRouterTransitionStart = enabled
  ? Sentry.captureRouterTransitionStart
  : () => {};
