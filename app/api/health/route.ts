/**
 * Sonde de disponibilité, pour le health check de Coolify.
 *
 * Sans health check, Coolify ne sait pas quand un nouveau conteneur est prêt :
 * il supprime donc l'ancien avant de démarrer le suivant, et chaque
 * déploiement coupe le site (503 constaté pendant le déploiement du
 * 2026-11-16). Avec, il peut démarrer le nouveau, attendre qu'il réponde ici,
 * puis basculer le trafic.
 *
 * Volontairement sans base ni TMDB : la sonde dit que le serveur Node répond.
 * Une panne de Neon ne doit pas faire redémarrer le conteneur en boucle — ni
 * réveiller la base toutes les quelques secondes, ce qui se facture.
 */
export const dynamic = "force-dynamic";

export function GET() {
  return new Response("ok", {
    headers: { "Content-Type": "text/plain", "Cache-Control": "no-store" },
  });
}
