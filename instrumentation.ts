/**
 * Point d'entrée d'instrumentation de Next : appelé une fois au démarrage du
 * serveur, avant tout rendu. On y initialise le SDK pour les deux runtimes
 * serveur, et on y branche le rapport d'erreurs de rendu.
 */
import * as Sentry from "@sentry/nextjs";
import { commonOptions } from "@/lib/sentry-options";

export async function register() {
  // `NEXT_RUNTIME` distingue le serveur Node du runtime edge : les deux
  // exécutent du code applicatif et doivent être instrumentés séparément.
  if (process.env.NEXT_RUNTIME === "nodejs" || process.env.NEXT_RUNTIME === "edge") {
    Sentry.init(commonOptions);
  }
}

/**
 * Remonte les erreurs levées pendant le rendu serveur — Server Components,
 * Server Actions, route handlers. Sans ce branchement, elles n'apparaissent que
 * dans les logs du conteneur, où personne ne les voit.
 */
export const onRequestError = Sentry.captureRequestError;
