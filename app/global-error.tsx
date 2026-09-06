"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";

/**
 * Dernier filet de l'App Router : ce qui casse dans le layout racine, donc au
 * dessus de toute autre frontière d'erreur.
 *
 * **Sans ce fichier, une classe entière de pannes était invisible.** Le SDK
 * navigateur s'appuie sur `globalHandlers`, qui accroche `window.onerror` ; or
 * React confie les erreurs de rendu à la frontière d'erreur la plus proche et
 * `window.onerror` n'est jamais atteint. L'App Router en fournit une par
 * défaut : elle affichait donc son écran générique pendant que la supervision
 * ne voyait rien passer.
 *
 * Le symptôme correspondait exactement à ce qu'on observait sur l'instance :
 * cinq jours d'exploitation, dix-neuf incidents, tous d'origine serveur, pas un
 * seul venu d'un navigateur — alors même que `POST /api/mn` recevait du trafic,
 * preuve que le SDK client était bien actif et tunnelait ses transactions.
 * L'absence d'erreurs navigateur ne disait pas que l'application n'en produit
 * pas, seulement que personne ne les ramassait.
 *
 * Ce composant remplace `<html>` et `<body>` : quand il s'affiche, le layout
 * racine est précisément ce qui a échoué, il ne peut pas les fournir.
 */
export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="fr">
      <body
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          margin: 0,
          padding: "2rem",
          fontFamily: "system-ui, -apple-system, sans-serif",
          background: "#0b0b0c",
          color: "#f4f4f5",
        }}
      >
        <main style={{ maxWidth: "32rem", textAlign: "center" }}>
          <h1 style={{ fontSize: "1.5rem", margin: "0 0 0.75rem" }}>
            Quelque chose s&apos;est cassé
          </h1>
          <p style={{ margin: "0 0 1.5rem", lineHeight: 1.6, opacity: 0.75 }}>
            L&apos;erreur nous a été signalée automatiquement. Recharger la page suffit le plus
            souvent à repartir.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{
              padding: "0.6rem 1.4rem",
              borderRadius: "999px",
              border: "1px solid rgba(244,244,245,0.25)",
              background: "transparent",
              color: "inherit",
              font: "inherit",
              cursor: "pointer",
            }}
          >
            Recharger
          </button>
          {/* Le digest est l'identifiant que Next attribue à l'erreur côté
              serveur ; c'est la seule prise pour relier ce qu'a vu
              l'utilisateur à l'incident correspondant dans GlitchTip. */}
          {error.digest && (
            <p style={{ marginTop: "1.5rem", fontSize: "0.75rem", opacity: 0.4 }}>
              Référence : {error.digest}
            </p>
          )}
        </main>
      </body>
    </html>
  );
}
