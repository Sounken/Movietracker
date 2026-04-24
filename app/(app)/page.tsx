import { getSession } from "@/lib/session";
import styles from "./dashboard.module.css";

export default async function DashboardPage() {
  const session = await getSession();
  const hour = new Date().getHours();
  const greet = hour < 12 ? "Bonjour" : hour < 18 ? "Bon après-midi" : "Bonsoir";

  return (
    <div className={styles.page}>
      <div className={styles.topbar}>
        <div className={styles.greet}>
          <div className={styles.hello}>
            <span className={styles.dot} />
            En ligne · {greet.toLowerCase()}
          </div>
          <h1 className={styles.title}>
            {greet}, <em>{session?.name ?? "Cinéphile"}</em>.
          </h1>
        </div>
      </div>

      <div className={styles.placeholder}>
        <p>Le dashboard arrive bientôt.</p>
      </div>
    </div>
  );
}
