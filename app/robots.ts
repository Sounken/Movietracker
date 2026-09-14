import type { MetadataRoute } from "next";

/**
 * Consignes d'exploration.
 *
 * Il n'y en avait aucune — `/robots.txt` répondait 404 — et c'est ce qui a
 * laissé un robot parcourir le catalogue TMDB fiche par fiche. Les fiches film,
 * série, acteur et société se lient les unes aux autres sans fin : un robot qui
 * suit les liens n'en voit jamais le bout, et chaque fiche lui est fabriquée à
 * la demande, appels TMDB compris.
 *
 * Ces fiches sont donc fermées à l'exploration. C'est un choix : elles ne
 * reprennent que des données publiques de TMDB, que les moteurs indexent déjà
 * à la source, et l'application est un journal personnel dont la valeur est
 * derrière la connexion. Si l'indexation des fiches film devenait souhaitable,
 * retirer `/film/` d'ici suffit — la limite de débit du proxy protège toujours
 * contre un parcours abusif.
 *
 * `/series/` couvre aussi les pages privées et les fiches ; `/series/discover`
 * et `/series/trends` sont rouvertes explicitement. Les moteurs appliquent la
 * règle la plus précise, l'autorisation l'emporte donc sur ces deux chemins.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: ["/series/discover", "/series/trends"],
      disallow: ["/film/", "/series/", "/actor/", "/company/", "/compare/", "/user/", "/api/", "/vitals"],
    },
  };
}
