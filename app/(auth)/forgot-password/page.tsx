"use client";

import { useActionState } from "react";
import Link from "next/link";
import { requestPasswordReset } from "@/app/actions/auth";
import styles from "../auth.module.css";

export default function ForgotPasswordPage() {
  const [state, action, pending] = useActionState(requestPasswordReset, undefined);

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <Link href="/" className={styles.brand} aria-label="Retour à l'accueil">
          <span className={styles.brandName}>
            Movie<em>tracker</em>
          </span>
        </Link>

        <h1 className={styles.title}>Mot de passe oublié</h1>

        {state?.sent ? (
          // Même message que l'adresse soit inscrite ou non : cf. requestPasswordReset.
          <div className={styles.success} role="status">
            Si un compte existe pour cette adresse, un e-mail vient de partir avec un lien
            pour choisir un nouveau mot de passe. Il est valable 1 heure — pensez à
            regarder dans les indésirables.
          </div>
        ) : (
          <>
            <p className={styles.subtitle}>
              Indiquez l&apos;adresse de votre compte : nous vous enverrons un lien pour en
              choisir un nouveau.
            </p>

            <form action={action} className={styles.form}>
              {state?.error && <div className={styles.error}>{state.error}</div>}

              <div className={styles.field}>
                <label htmlFor="email" className={styles.label}>Email</label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  autoFocus
                  className={styles.input}
                  placeholder="vous@exemple.com"
                />
              </div>

              <button type="submit" disabled={pending} className={styles.btn}>
                {pending ? "Envoi…" : "Recevoir le lien"}
              </button>
            </form>
          </>
        )}

        <p className={styles.switchLink}>
          <Link href="/login">Retour à la connexion</Link>
        </p>
      </div>
    </div>
  );
}
