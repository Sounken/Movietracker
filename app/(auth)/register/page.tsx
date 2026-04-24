"use client";

import { useActionState } from "react";
import Link from "next/link";
import { register } from "@/app/actions/auth";
import styles from "../auth.module.css";

export default function RegisterPage() {
  const [state, action, pending] = useActionState(register, undefined);

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <div className={styles.brand}>
          <span className={styles.brandName}>
            Movie<em>tracker</em>
          </span>
        </div>

        <h1 className={styles.title}>Créer un compte</h1>
        <p className={styles.subtitle}>Rejoignez la communauté cinéphile.</p>

        <form action={action} className={styles.form}>
          {state?.error && (
            <div className={styles.error}>{state.error}</div>
          )}

          <div className={styles.field}>
            <label htmlFor="name" className={styles.label}>Prénom</label>
            <input
              id="name"
              name="name"
              type="text"
              autoComplete="name"
              required
              className={styles.input}
              placeholder="Damien"
            />
          </div>

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
            <label htmlFor="password" className={styles.label}>
              Mot de passe <span className={styles.hint}>(min. 8 caractères)</span>
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              className={styles.input}
              placeholder="••••••••"
            />
          </div>

          <button type="submit" disabled={pending} className={styles.btn}>
            {pending ? "Création…" : "Créer mon compte"}
          </button>
        </form>

        <p className={styles.switchLink}>
          Déjà un compte ? <Link href="/login">Se connecter</Link>
        </p>
      </div>
    </div>
  );
}
