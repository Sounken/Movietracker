"use client";

import { useEffect, useRef } from "react";
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

  /**
   * Route courante, lue au moment de l'envoi.
   *
   * Une référence plutôt qu'une dépendance d'effet, et c'est tout l'objet du
   * correctif : voir plus bas.
   */
  const routeRef = useRef(normalizeRoute(pathname));
  useEffect(() => {
    routeRef.current = normalizeRoute(pathname);
  }, [pathname]);

  /**
   * Abonnement unique, pour toute la durée de vie de la page.
   *
   * **Cet effet dépendait de `pathname`.** Il se réexécutait donc à chaque
   * navigation, et rappelait `onLCP`, `onINP`, `onCLS`, `onTTFB`, `onFCP` —
   * or `web-vitals` ne déduplique pas, elle empile les abonnés, et n'offre
   * aucun moyen de se désabonner. Un visiteur qui enchaînait vingt pages
   * repartait avec vingt jeux d'abonnés ; au passage de l'onglet en arrière-
   * plan, CLS et INP se finalisaient et envoyaient vingt relevés par métrique
   * au lieu d'un. Plus la session était longue, plus le volume enflait.
   *
   * C'est ce qui a rempli la table : 166 Mo en moins de quatorze jours, contre
   * quelques centaines de kilo-octets pour tout le reste de la base.
   *
   * Le tableau de dépendances vide est ici correct, et pas un raccourci : ces
   * mesures portent sur le chargement de page, pas sur la navigation douce.
   * LCP, FCP et TTFB se produisent une fois ; CLS et INP s'accumulent sur
   * toute la durée de vie de la page. Elles ne se réinitialisent pas d'une
   * navigation SPA à l'autre — s'y abonner une fois est ce que la
   * bibliothèque attend.
   */
  useEffect(() => {
    const send = (metric: Metric) => {
      const body = JSON.stringify({
        // Lue à l'envoi, et non capturée à l'abonnement : une métrique
        // finalisée après une navigation est attribuée à la page affichée au
        // moment où elle se conclut.
        route: routeRef.current,
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
    // Tableau vide : abonnement unique au chargement de la page. Le lint ne
    // réclame rien — `send` ne lit plus que `routeRef`, dont l'identité est
    // stable. Ajouter `pathname` ici est précisément le défaut qui a rempli la
    // table, et rien dans l'outillage ne l'aurait signalé.
  }, []);

  return null;
}
