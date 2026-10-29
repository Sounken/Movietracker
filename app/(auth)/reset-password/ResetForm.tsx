"use client";

import { useActionState } from "react";
import Link from "next/link";
import { resetPassword } from "@/app/actions/auth";
import styles from "../auth.module.css";

export default function ResetForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState(resetPassword, undefined);

  if (state?.done) {
    return (
      <>
        <div className={styles.success} role="status">
          Mot de passe modifié. Par sécurité, tous vos appareils ont été déconnectés :
          reconnectez-vous avec le nouveau.
        </div>
        <Link href="/login" className={`${styles.btn} ${styles.btnLink}`}>
          Se connecter
        </Link>
      </>
    );
  }

  return (
    <form action={action} className={styles.form}>
      {state?.error && <div className={styles.error}>{state.error}</div>}
      <input type="hidden" name="token" value={token} />

      <div className={styles.field}>
        <label htmlFor="password" className={styles.label}>
          Nouveau mot de passe <span className={styles.hint}>(min. 8 caractères)</span>
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
          autoFocus
          className={styles.input}
          placeholder="••••••••"
        />
      </div>

      <div className={styles.field}>
        <label htmlFor="confirm" className={styles.label}>Confirmation</label>
        <input
          id="confirm"
          name="confirm"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
          className={styles.input}
          placeholder="••••••••"
        />
      </div>

      <button type="submit" disabled={pending} className={styles.btn}>
        {pending ? "Enregistrement…" : "Changer le mot de passe"}
      </button>
    </form>
  );
}
