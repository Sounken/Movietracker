import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "image.tmdb.org",
        pathname: "/t/p/**",
      },
    ],
    // URLs locales avec query string (cache-busting `?v=…` après upload) :
    // Next 16 les rejette par défaut, il faut les autoriser explicitement.
    localPatterns: [
      { pathname: "/api/profile-media/**" },
      { pathname: "/uploads/**" },
      // Assets statiques de public/ (logo, etc.) — sinon 400 sur /_next/image
      { pathname: "/*.png" },
      { pathname: "/*.svg" },
    ],
  },
  // Anciennes URLs (films à la racine) → nouvelle structure /films/* — préserve
  // les favoris et l'app épinglée (PWA). Redirections temporaires (307).
  async redirects() {
    return [
      { source: "/", destination: "/films", permanent: false },
      { source: "/discover", destination: "/films/discover", permanent: false },
      { source: "/watchlist", destination: "/films/watchlist", permanent: false },
      { source: "/lists", destination: "/films/lists", permanent: false },
      { source: "/lists/:id", destination: "/films/lists/:id", permanent: false },
      { source: "/favorites", destination: "/films/favorites", permanent: false },
      { source: "/trends", destination: "/films/trends", permanent: false },
      { source: "/profile", destination: "/films/profile", permanent: false },
    ];
  },
};

export default nextConfig;
