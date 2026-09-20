import AppShell from "../(app)/components/AppShell";

/**
 * Fiches film, série, acteur et société.
 *
 * Elles s'affichaient sans navigation : ouvrir un film depuis Découvrir
 * faisait disparaître Bibliothèque et Social, et il fallait revenir en arrière
 * pour les retrouver. Elles partagent désormais le cadre de l'application.
 *
 * `flush` : la zone de contenu ne leur impose ni marges ni largeur maximale —
 * elles ont leur propre mise en page. La barre latérale disparaît d'elle-même
 * sous 768px, où la navigation passe par la barre du bas.
 *
 * `AppShell` fournit aussi l'échelle de notation, que ce layout allait
 * auparavant chercher lui-même.
 */
export default function StandaloneLayout({ children }: { children: React.ReactNode }) {
  return <AppShell flush>{children}</AppShell>;
}
