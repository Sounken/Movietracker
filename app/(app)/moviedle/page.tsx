import type { Metadata } from "next";
import { getSession } from "@/lib/session";
import { getPuzzleState, getStreak } from "@/app/actions/puzzle";
import PuzzleBoard from "../components/PuzzleBoard";
import styles from "../films/dashboard.module.css";

export const metadata: Metadata = {
  title: "Moviedle : devinez le film du jour",
  description:
    "Le jeu de cinéma quotidien : proposez un film, comparez réalisateur, acteurs, genres et année, et trouvez le film mystère du jour. Gratuit, sans inscription.",
  alternates: { canonical: "/moviedle" },
};

/**
 * Jouable sans compte : c'est la page qu'un visiteur venu de Google ou d'un
 * lien partagé peut essayer tout de suite. Le compte ne sert plus qu'à
 * garder sa série de victoires d'un jour à l'autre.
 */
export default async function MoviedlePage() {
  const [session, state, streak] = await Promise.all([
    getSession(),
    getPuzzleState("movie"),
    getStreak("movie"),
  ]);

  return (
    <div className={styles.page}>
      <PuzzleBoard media="movie" initial={state} streak={streak} guest={!session} />
    </div>
  );
}
