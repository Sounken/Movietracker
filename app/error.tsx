"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";

/**
 * Frontière d'erreur commune à toutes les routes (le layout racine, lui, relève
 * de `global-error.tsx`).
 *
 * Elle sert deux fins. D'abord **remonter** : une erreur interceptée ici
 * n'atteint jamais `window.onerror`, donc jamais le SDK, si personne ne la
 * signale explicitement. Ensuite **rattraper l'utilisateur**, là où l'écran par
 * défaut de Next se contente d'annoncer la panne.
 *
 * Le cas le plus fréquent en production est le déploiement à chaud : un onglet
 * resté ouvert poste une Server Action dont l'identifiant n'existe plus dans le
 * nouveau bundle — trente-six occurrences en cinq jours. D'où le rechargement
 * complet mis en avant plutôt que `reset()` : réessayer le rendu ne sert à rien
 * quand c'est le bundle chargé qui est périmé, seul un aller-retour au serveur
 * ramène la version courante. `reset()` reste offert en second pour les pannes
 * réellement passagères, un appel TMDB qui a échoué par exemple.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Les erreurs sans intérêt — Server Action périmée, chunk manquant — sont
    // écartées par `ignoreErrors` dans lib/sentry-options.ts. On capture donc
    // sans trier ici : le filtre est déjà au bon endroit, et en un seul.
    Sentry.captureException(error);
  }, [error]);

  return (
    <main
      style={{
        minHeight: "60vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "0.75rem",
        padding: "2rem",
        textAlign: "center",
      }}
    >
      <h1 style={{ fontFamily: "var(--font-serif), Georgia, serif", fontSize: "1.75rem", margin: 0 }}>
        Cette page n&apos;a pas pu s&apos;afficher
      </h1>
      <p style={{ margin: 0, maxWidth: "30rem", lineHeight: 1.6, opacity: 0.7 }}>
        Si l&apos;application vient d&apos;être mise à jour, recharger suffit à repartir.
      </p>

      <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem", flexWrap: "wrap", justifyContent: "center" }}>
        <button
          type="button"
          onClick={() => window.location.reload()}
          style={{
            padding: "0.55rem 1.3rem",
            borderRadius: "999px",
            border: "1px solid currentColor",
            background: "transparent",
            color: "inherit",
            font: "inherit",
            cursor: "pointer",
          }}
        >
          Recharger la page
        </button>
        <button
          type="button"
          onClick={reset}
          style={{
            padding: "0.55rem 1.3rem",
            borderRadius: "999px",
            border: "1px solid transparent",
            background: "transparent",
            color: "inherit",
            font: "inherit",
            opacity: 0.6,
            cursor: "pointer",
          }}
        >
          Réessayer
        </button>
      </div>

      {error.digest && (
        <p style={{ marginTop: "1rem", fontSize: "0.75rem", opacity: 0.4 }}>
          Référence : {error.digest}
        </p>
      )}
    </main>
  );
}
