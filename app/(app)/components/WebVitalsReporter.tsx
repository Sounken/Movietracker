"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { onLCP, onINP, onCLS, onTTFB, onFCP, type Metric } from "web-vitals";
import { normalizeRoute } from "@/lib/web-vitals-route";

/**
 * Relève les Core Web Vitals et les envoie à notre propre route de collecte.
 *
 * GlitchTip s'arrête aux transactions serveur : il dira que la fiche film
 * répond en 120 ms, pas que son plus gros élément met deux secondes à
 * s'afficher chez le visiteur. C'est cette moitié-là que ce composant couvre.
 */
export default function WebVitalsReporter() {
  const pathname = usePathname();

  useEffect(() => {
    // Le chemin est capturé au moment de la mesure : une métrique arrivant
    // après une navigation doit rester attribuée à la page qui l'a produite.
    const route = normalizeRoute(pathname);

    const send = (metric: Metric) => {
      const body = JSON.stringify({
        route,
        metric: metric.name,
        value: metric.value,
        rating: metric.rating,
        navigationType: metric.navigationType,
      });

      /**
       * `sendBeacon` plutôt que `fetch` : la plupart de ces métriques sont
       * finalisées au moment où l'onglet passe en arrière-plan ou se ferme, et
       * un `fetch` classique serait annulé par le navigateur à cet instant
       * précis. Le beacon, lui, est remis au système qui le transmettra.
       */
      if (navigator.sendBeacon?.(
        "/api/vitals",
        new Blob([body], { type: "application/json" }),
      )) {
        return;
      }

      // Repli pour les navigateurs sans `sendBeacon`, ou s'il refuse la charge.
      void fetch("/api/vitals", {
        method: "POST",
        body,
        headers: { "Content-Type": "application/json" },
        keepalive: true,
      }).catch(() => {
        // Une mesure perdue n'est pas un incident : on ne remonte rien.
      });
    };

    onLCP(send);
    onINP(send);
    onCLS(send);
    onTTFB(send);
    onFCP(send);
  }, [pathname]);

  return null;
}
