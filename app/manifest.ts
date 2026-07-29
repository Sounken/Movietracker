import type { MetadataRoute } from "next";

// Manifeste PWA : icône + nom pour l'ajout à l'écran d'accueil (Android/Chrome
// surtout ; iOS s'appuie plutôt sur apple-icon). Mode standalone = sans barre navigateur.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "MovieTracker",
    short_name: "MovieTracker",
    description: "Votre journal de cinéma personnel",
    start_url: "/films",
    display: "standalone",
    background_color: "#0d0b0a",
    theme_color: "#0d0b0a",
    icons: [
      { src: "/icon.png", sizes: "any", type: "image/png" },
      { src: "/apple-icon", sizes: "180x180", type: "image/png" },
    ],
  };
}
