import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";

// La page d'inscription est un composant client : ses métadonnées passent par
// ce layout, qui ne rend rien d'autre que la page.
export const metadata: Metadata = {
  title: "Créer un compte gratuit",
  description:
    "Créez votre compte MovieTracker gratuit : notez vos films et séries, suivez vos épisodes, gardez une liste à voir et partagez vos avis avec vos amis.",
  alternates: { canonical: "/register" },
};

/**
 * Déjà connecté : direction l'accueil. La règle vivait dans le proxy, qui ne lit
 * que la signature du cookie : une session révoquée par une réinitialisation
 * du mot de passe y passait pour valide, et renvoyait vers un accueil où l'on
 * apparaît déconnecté — impossible d'atteindre la page de connexion.
 */
export default async function RegisterLayout({ children }: { children: React.ReactNode }) {
  if (await getSession()) redirect("/films");
  return children;
}
