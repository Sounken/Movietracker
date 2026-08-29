import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Notre optimiseur ne voit plus que nos propres fichiers (avatars,
    // bannières) : les visuels TMDB partent directement vers leur CDN, cf.
    // `lib/tmdb-image-loader.ts`.
    loaderFile: "./lib/tmdb-image-loader.ts",

    // Aucune image servie par nous ne dépasse 1600px (largeur de sortie du
    // recadrage de bannière). Les paliers 2048 et 3840 par défaut ne
    // produisaient que des variantes que personne ne demande.
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],

    // Les uploads portent un `?v=…` renouvelé à chaque enregistrement : leur
    // contenu ne change jamais à URL constante, on peut donc les garder en
    // cache bien plus longtemps que les 4h par défaut.
    minimumCacheTTL: 2_592_000, // 30 jours

    /**
     * Plafond du cache disque des images. **À ne jamais laisser implicite.**
     *
     * Non renseigné, Next dimensionne son LRU à « 50% de l'espace disque
     * disponible » mesuré au démarrage (`disk-lru-cache.external.js` :
     * `maxSize = Math.floor(bavail * bsize / 2)`). Il n'évince donc rien tant
     * que ce budget n'est pas atteint : sur notre serveur, `/app/.next/cache`
     * est monté jusqu'à 19 Go, à raison d'environ 1 Go par heure. Le calcul
     * étant fait au démarrage et le disque partagé avec l'autre app, Next
     * s'octroyait la moitié de ce qui était libre sans rien savoir du voisin.
     *
     * 256 Mo suffisent très largement depuis que les visuels TMDB et les
     * vignettes YouTube partent vers leurs CDN respectifs : il ne reste à
     * optimiser que nos propres avatars et bannières.
     */
    maximumDiskCacheSize: 256 * 1024 * 1024,

    remotePatterns: [
      {
        protocol: "https",
        hostname: "image.tmdb.org",
        pathname: "/t/p/**",
      },
      // Vignettes des bandes-annonces : on affiche l'image YouTube tant que
      // l'utilisateur n'a pas lancé la lecture, pour ne pas charger le lecteur
      // (ni ses cookies tiers) sur chaque fiche.
      {
        protocol: "https",
        hostname: "i.ytimg.com",
        pathname: "/vi/**",
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
