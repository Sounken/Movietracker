/**
 * Initialisation côté navigateur. Next charge ce fichier avant le code de
 * l'application, ce qui permet de capturer les erreurs survenues pendant
 * l'hydratation — les plus pénibles à reproduire autrement.
 */
import * as Sentry from "@sentry/nextjs";
import { commonOptions, enabled } from "@/lib/sentry-options";

Sentry.init({
  ...commonOptions,
  /**
   * Pas de `replayIntegration` : GlitchTip ne gère pas le session replay, c'est
   * un choix assumé du projet. L'activer enverrait des enregistrements que
   * l'instance rejetterait, en pure perte de bande passante.
   */
  integrations: [],
});

/** Nécessaire pour que les transitions de route apparaissent dans les traces. */
export const onRouterTransitionStart = enabled
  ? Sentry.captureRouterTransitionStart
  : () => {};
