import type { Metadata } from "next";

// La page de connexion est un composant client : ses métadonnées passent par
// ce layout, qui ne rend rien d'autre que la page.
export const metadata: Metadata = {
  title: "Connexion",
  // Rien à trouver ici depuis un moteur : on garde la place pour l'inscription.
  robots: { index: false, follow: true },
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
