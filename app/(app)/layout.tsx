import AppShell from "./components/AppShell";

/**
 * Le cadre vit dans `AppShell`, partagé avec le groupe `(standalone)` pour que
 * les fiches aient elles aussi la barre latérale.
 */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
