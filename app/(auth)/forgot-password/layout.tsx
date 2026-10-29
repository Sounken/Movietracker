import type { Metadata } from "next";

// Page cliente : ses métadonnées passent par ce layout.
export const metadata: Metadata = {
  title: "Mot de passe oublié",
  robots: { index: false, follow: false },
};

export default function ForgotPasswordLayout({ children }: { children: React.ReactNode }) {
  return children;
}
