"use client";

import { useState, useTransition } from "react";
import { Check } from "lucide-react";
import { WATCH_PROVIDERS } from "@/lib/tmdb-catalog";
import { updateWatchProviders, type PushPreferences } from "@/app/actions/settings";
import PushSettings from "./PushSettings";
import styles from "./settings.module.css";

export default function SettingsClient({
  watchProviders,
  pushPreferences,
  pushConfigured,
}: {
  watchProviders: number[];
  pushPreferences: PushPreferences;
  /** Clés VAPID présentes côté serveur. */
  pushConfigured: boolean;
}) {
  const [selected, setSelected] = useState<number[]>(watchProviders);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");

  // Enregistré à chaque clic : une case à cocher n'appelle pas de bouton
  // « Sauvegarder », et l'oublier ferait perdre la sélection.
  const toggle = (id: number) => {
    const previous = selected;
    const next = selected.includes(id) ? selected.filter((p) => p !== id) : [...selected, id];
    setSelected(next);
    setError("");
    startTransition(async () => {
      try {
        await updateWatchProviders(next);
      } catch {
        setSelected(previous);
        setError("Enregistrement impossible, réessayez.");
      }
    });
  };

  return (
    <>
      <div className={styles.sectionHead}>
        <div className={styles.sectionSub}>Compte</div>
        <h2 className={styles.sectionTitle}>Réglages</h2>
      </div>

      <section className={styles.card}>
        <div className={styles.cardHead}>
          <h3 className={styles.cardTitle}>Mes plateformes</h3>
          <span className={styles.status} aria-live="polite">
            {error || (isPending ? "Enregistrement…" : "")}
          </span>
        </div>
        <p className={styles.cardText}>
          Les services auxquels vous êtes abonné. Découvrir peut n&apos;afficher que ce qu&apos;ils
          proposent, et les fiches signalent ce qui y est inclus.
        </p>
        <div className={styles.providers}>
          {WATCH_PROVIDERS.map((p) => {
            const on = selected.includes(p.id);
            return (
              <button
                key={p.id}
                type="button"
                className={`${styles.provider} ${on ? styles.providerOn : ""}`}
                onClick={() => toggle(p.id)}
                aria-pressed={on}
              >
                <span className={`${styles.checkBox} ${on ? styles.checkBoxOn : ""}`}>
                  {on && <Check size={11} strokeWidth={3} />}
                </span>
                {p.name}
              </button>
            );
          })}
        </div>
      </section>

      {pushConfigured && <PushSettings initialPreferences={pushPreferences} />}
    </>
  );
}
