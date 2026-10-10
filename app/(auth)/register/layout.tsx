import type { Metadata } from "next";

// La page d'inscription est un composant client : ses métadonnées passent par
// ce layout, qui ne rend rien d'autre que la page.
export const metadata: Metadata = {
  title: "Créer un compte gratuit",
  description:
    "Créez votre compte MovieTracker gratuit : notez vos films et séries, suivez vos épisodes, gardez une liste à voir et partagez vos avis avec vos amis.",
  alternates: { canonical: "/register" },
};

export default function RegisterLayout({ children }: { children: React.ReactNode }) {
  return children;
}
