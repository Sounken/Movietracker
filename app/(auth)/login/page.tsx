"use client";

import { useActionState } from "react";
import Link from "next/link";
import { login } from "@/app/actions/auth";
import styles from "../auth.module.css";

export default function LoginPage() {
  const [state, action, pending] = useActionState(login, undefined);

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <div className={styles.brand}>
          <span className={styles.brandName}>
            Movie<em>tracker</em>
          </span>
        </div>

        <h1 className={styles.title}>Connexion</h1>
        <p className={styles.subtitle}>Content de vous revoir, Damien.</p>

        <form action={action} className={styles.form}>
          {state?.error && (
            <div className={styles.error}>{state.error}</div>
          )}

          <div className={styles.field}>
            <label htmlFor="email" className={styles.label}>Email</label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              className={styles.input}
              placeholder="vous@exemple.com"
            />
          </div>

          <div className={styles.field}>
            <label htmlFor="password" className={styles.label}>Mot de passe</label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              className={styles.input}
              placeholder="••••••••"
            />
          </div>

          <button type="submit" disabled={pending} className={styles.btn}>
            {pending ? "Connexion…" : "Se connecter"}
          </button>
        </form>

        <p className={styles.switchLink}>
          Pas encore de compte ?{" "}
          <Link href="/register">Créer un compte</Link>
        </p>
      </div>
    </div>
  );
}
