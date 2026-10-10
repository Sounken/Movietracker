import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

/**
 * Pages publiques proposées aux moteurs.
 *
 * Volontairement courte : seules les pages qu'un visiteur sans compte peut
 * lire, et que `robots.ts` laisse explorer. `/films` et `/series` n'y sont
 * pas : sans compte, elles redirigent vers « Découvrir », déjà listée. Les
 * fiches TMDB non plus — voir `robots.ts`.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const pages: { path: string; changeFrequency: "daily" | "weekly" | "monthly"; priority: number }[] = [
    { path: "/films/discover", changeFrequency: "daily", priority: 1 },
    { path: "/series/discover", changeFrequency: "daily", priority: 0.9 },
    // Une grille par jour : c'est la page qui change le plus souvent.
    { path: "/moviedle", changeFrequency: "daily", priority: 0.9 },
    { path: "/series/moviedle", changeFrequency: "daily", priority: 0.8 },
    { path: "/films/trends", changeFrequency: "daily", priority: 0.7 },
    { path: "/series/trends", changeFrequency: "daily", priority: 0.7 },
    { path: "/register", changeFrequency: "monthly", priority: 0.5 },
  ];

  return pages.map((p) => ({
    url: `${SITE_URL}${p.path}`,
    changeFrequency: p.changeFrequency,
    priority: p.priority,
  }));
}
