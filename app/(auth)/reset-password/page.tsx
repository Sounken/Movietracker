import type { Metadata } from "next";
import Link from "next/link";
import { findValidResetToken } from "@/lib/password-reset";
import ResetForm from "./ResetForm";
import styles from "../auth.module.css";

export const metadata: Metadata = {
  title: "Nouveau mot de passe",
  robots: { index: false, follow: false },
};

/**
 * Arrivée depuis le lien de l'e-mail.
 *
 * Le jeton est vérifié dès l'affichage : un lien expiré le dit tout de suite,
 * plutôt qu'après avoir tapé deux fois un nouveau mot de passe. Il l'est de
 * nouveau à l'envoi, seul contrôle qui compte.
 */
export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token = "" } = await searchParams;
  const valid = Boolean(await findValidResetToken(token));

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <Link href="/" className={styles.brand} aria-label="Retour à l'accueil">
          <span className={styles.brandName}>
            Movie<em>tracker</em>
          </span>
        </Link>

        <h1 className={styles.title}>Nouveau mot de passe</h1>

        {valid ? (
          <>
            <p className={styles.subtitle}>Choisissez le nouveau mot de passe de votre compte.</p>
            <ResetForm token={token} />
          </>
        ) : (
          <>
            <div className={styles.error}>
              Ce lien n&apos;est plus valable : il a expiré (1 heure) ou a déjà servi.
            </div>
            <p className={styles.switchLink}>
              <Link href="/forgot-password">Demander un nouveau lien</Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
