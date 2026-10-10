import type { Metadata } from "next";
import { getSession } from "@/lib/session";
import { getPuzzleState, getStreak } from "@/app/actions/puzzle";
import PuzzleBoard from "../../components/PuzzleBoard";
import styles from "../../films/dashboard.module.css";

export const metadata: Metadata = {
  title: "Moviedle séries : devinez la série du jour",
  description:
    "Le jeu quotidien des séries : proposez une série, comparez création, acteurs, chaîne et année, et trouvez la série mystère du jour. Gratuit, sans inscription.",
  alternates: { canonical: "/series/moviedle" },
};

/** Même jeu que `/moviedle`, sur le vivier des séries — jouable sans compte lui aussi. */
export default async function SeriesMoviedlePage() {
  const [session, state, streak] = await Promise.all([
    getSession(),
    getPuzzleState("tv"),
    getStreak("tv"),
  ]);

  return (
    <div className={styles.page}>
      <PuzzleBoard media="tv" initial={state} streak={streak} guest={!session} />
    </div>
  );
}
