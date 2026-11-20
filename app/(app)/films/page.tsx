import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";
import { HERO_SOURCES, type HeroSource } from "./home-data";
import FilmsHome from "./FilmsHome";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ source?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/films/discover");

  // Source du carrousel, pilotée par l'URL comme les filtres de Découvrir :
  // la section est rendue côté serveur, un état client obligerait à lui
  // envoyer les deux jeux de résultats.
  const { source: raw } = await searchParams;
  const source: HeroSource =
    HERO_SOURCES.some((s) => s.id === raw) ? (raw as HeroSource) : "cinema";

  return <FilmsHome userId={session.userId} source={source} />;
}
