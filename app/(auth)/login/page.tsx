"use client";

import { useActionState, useState, useEffect } from "react";
import Link from "next/link";
import { login } from "@/app/actions/auth";
import styles from "../auth.module.css";

const PHRASES = [
  "Content de vous revoir.",
  "Bon retour parmi nous.",
  "Votre cinémathèque vous attend.",
  "Prêt pour votre prochaine séance ?",
  "De nouveaux films n'attendent que vous.",
  "La salle est à vous.",
  "Bienvenue de retour, cinéphile.",
  "Qu'allez-vous regarder ce soir ?",
  "La lumière s'éteint, le film commence.",
  "Tous vos films, en un seul endroit.",
  "Le septième art vous accueille.",
  "Que le spectacle commence.",
  "Un billet pour votre prochaine aventure ?",
  "Ravi de vous retrouver.",
  "Vos souvenirs cinématographiques vous attendent.",
  "Où en êtes-vous dans votre liste ?",
  "Le cinéma vous a manqué ?",
  "À vous les étoiles.",
  "Votre journal cinématographique vous attend.",
  "Le septième art n'attend que vous.",
];

export default function LoginPage() {
  const [state, action, pending] = useActionState(login, undefined);
  const [phrase, setPhrase] = useState(PHRASES[0]);
  useEffect(() => { setPhrase(PHRASES[Math.floor(Math.random() * PHRASES.length)]); }, []);

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <div className={styles.brand}>
          <span className={styles.brandName}>
            Movie<em>tracker</em>
          </span>
        </div>

        <h1 className={styles.title}>Connexion</h1>
        <p className={styles.subtitle}>{phrase}</p>

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
