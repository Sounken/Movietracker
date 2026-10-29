import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";

// La page de connexion est un composant client : ses métadonnées passent par
// ce layout, qui ne rend rien d'autre que la page.
export const metadata: Metadata = {
  title: "Connexion",
  // Rien à trouver ici depuis un moteur : on garde la place pour l'inscription.
  robots: { index: false, follow: true },
};

/**
 * Déjà connecté : direction l'accueil. La règle vivait dans le proxy, qui ne lit
 * que la signature du cookie : une session révoquée par une réinitialisation
 * du mot de passe y passait pour valide, et renvoyait vers un accueil où l'on
 * apparaît déconnecté — impossible d'atteindre la page de connexion.
 */
export default async function LoginLayout({ children }: { children: React.ReactNode }) {
  if (await getSession()) redirect("/films");
  return children;
}
