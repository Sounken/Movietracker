import type { MetadataRoute } from "next";

// Manifeste PWA : icône + nom pour l'ajout à l'écran d'accueil (Android/Chrome
// surtout ; iOS s'appuie plutôt sur apple-icon). Mode standalone = sans barre navigateur,
// et condition des notifications push sur iPhone (cf. lib/push.ts).
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "MovieTracker",
    short_name: "MovieTracker",
    description: "Votre journal de cinéma personnel",
    start_url: "/films",
    display: "standalone",
    background_color: "#0d0b0a",
    theme_color: "#0d0b0a",
    // 192 et 512 px : le minimum pour qu'Android propose l'installation.
    icons: [
      { src: "/pwa-icon/192", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/pwa-icon/512", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/pwa-icon/512", sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: "/apple-icon", sizes: "180x180", type: "image/png" },
    ],
  };
}
