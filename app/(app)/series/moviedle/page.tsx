import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { getPuzzleState, getStreak } from "@/app/actions/puzzle";
import PuzzleBoard from "../../components/PuzzleBoard";
import styles from "../../films/dashboard.module.css";

export const metadata = { title: "Moviedle — la série du jour" };

/**
 * Même jeu que `/moviedle`, sur le vivier des séries. Le jeu exige un compte : les parties sont enregistrées par joueur, et la
 * série de victoires n'aurait aucun sens en anonyme.
 */
export default async function SeriesMoviedlePage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const [state, streak] = await Promise.all([getPuzzleState("tv"), getStreak("tv")]);

  return (
    <div className={styles.page}>
      <PuzzleBoard media="tv" initial={state} streak={streak} />
    </div>
  );
}
