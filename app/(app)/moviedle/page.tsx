import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { getPuzzleState, getStreak } from "@/app/actions/puzzle";
import PuzzleBoard from "../components/PuzzleBoard";
import styles from "../films/dashboard.module.css";

export const metadata = { title: "Moviedle — le film du jour" };

/**
 * Le jeu exige un compte : les parties sont enregistrées par joueur, et la
 * série de victoires n'aurait aucun sens en anonyme.
 */
export default async function MoviedlePage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const [state, streak] = await Promise.all([getPuzzleState("movie"), getStreak("movie")]);

  return (
    <div className={styles.page}>
      <PuzzleBoard media="movie" initial={state} streak={streak} />
    </div>
  );
}
