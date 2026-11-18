"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Bell, BellRing } from "lucide-react";
import { toggleReminder } from "@/app/actions/reminders";
import styles from "./ReminderToggle.module.css";

/**
 * « Me prévenir » d'une sortie. `compact` : icône seule (lignes du
 * calendrier) ; sinon bouton pleine largeur (colonne de la fiche).
 */
export default function ReminderToggle({
  tmdbId,
  initial,
  label,
  compact = false,
  isAuthenticated = true,
}: {
  tmdbId: number;
  initial: boolean;
  /** Libellé du bouton inactif, ex. « Me prévenir de la sortie (12 févr.) ». */
  label?: string;
  compact?: boolean;
  isAuthenticated?: boolean;
}) {
  const router = useRouter();
  const [on, setOn] = useState(initial);
  const [isPending, startTransition] = useTransition();

  const toggle = () => {
    if (!isAuthenticated) {
      router.push("/login");
      return;
    }
    const previous = on;
    setOn(!on);
    startTransition(async () => {
      try {
        setOn(await toggleReminder(tmdbId));
      } catch {
        setOn(previous);
      }
    });
  };

  const Icon = on ? BellRing : Bell;
  const text = on ? "Rappel activé" : (label ?? "Me prévenir");

  return (
    <button
      type="button"
      className={`${compact ? styles.compact : styles.full} ${on ? styles.on : ""}`}
      onClick={toggle}
      disabled={isPending}
      aria-pressed={on}
      title={on ? "Vous serez prévenu le jour de la sortie — cliquer pour annuler" : "Être prévenu le jour de la sortie"}
      aria-label={compact ? text : undefined}
    >
      <Icon size={compact ? 15 : 14} />
      {!compact && <span>{text}</span>}
    </button>
  );
}
