"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CalendarPlus, RotateCcw, X } from "lucide-react";
import { deleteFilmWatch, logFilmWatch } from "@/app/actions/journal";
import { formatWatchDate, localToday } from "@/lib/watch-date";
import styles from "./DiaryBlock.module.css";

export type DiaryWatch = { id: string; watchedAt: string; note: string | null };

/**
 * Journal du film sur sa fiche : quand on l'a vu, combien de fois.
 *
 * Séparé du widget de note, partagé avec les séries : le journal ne concerne
 * que les films. Une note donnée sans date laisse le film « vu, sans date » ;
 * c'est ici qu'on le date, en un clic pour le cas courant (aujourd'hui).
 */
export default function DiaryBlock({
  tmdbId,
  watches,
  watched,
}: {
  tmdbId: number;
  /** Du plus récent au plus ancien. */
  watches: DiaryWatch[];
  watched: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [formOpen, setFormOpen] = useState(false);
  const [date, setDate] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");

  const run = (action: () => Promise<void>, after?: () => void) => {
    setError("");
    startTransition(async () => {
      try {
        await action();
        after?.();
        router.refresh();
      } catch {
        setError("Enregistrement impossible, réessayez.");
      }
    });
  };

  const openForm = () => {
    setDate(localToday());
    setNote("");
    setFormOpen(true);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    run(() => logFilmWatch(tmdbId, date, note), () => setFormOpen(false));
  };

  const count = watches.length;
  const summary =
    count === 0
      ? watched
        ? "Vu, sans date — quand l'avez-vous vu ?"
        : "Pas encore dans votre journal"
      : count === 1
        ? `Vu le ${formatWatchDate(watches[0].watchedAt)}`
        : `Vu ${count} fois · dernière fois le ${formatWatchDate(watches[0].watchedAt)}`;

  return (
    <div className={styles.wrap}>
      <div className={styles.head}>
        <div className={styles.label}>
          <Link href="/films/journal" className={styles.title}>Journal</Link>
          <span className={styles.summary}>{summary}</span>
        </div>

        {!formOpen && (
          <div className={styles.actions}>
            {count === 0 ? (
              <>
                <button
                  type="button"
                  className={`${styles.btn} ${styles.btnAccent}`}
                  disabled={isPending}
                  onClick={() => run(() => logFilmWatch(tmdbId, localToday()))}
                >
                  <CalendarPlus size={14} /> Vu aujourd&apos;hui
                </button>
                <button type="button" className={styles.btn} disabled={isPending} onClick={openForm}>
                  Autre date…
                </button>
              </>
            ) : (
              <button type="button" className={styles.btn} disabled={isPending} onClick={openForm}>
                <RotateCcw size={14} /> J&apos;ai revu ce film
              </button>
            )}
          </div>
        )}
      </div>

      {formOpen && (
        <form className={styles.form} onSubmit={submit}>
          <input
            type="date"
            className={styles.input}
            value={date}
            max={localToday()}
            min="1900-01-01"
            required
            onChange={(e) => setDate(e.target.value)}
            aria-label="Date du visionnage"
          />
          <input
            type="text"
            className={`${styles.input} ${styles.noteInput}`}
            value={note}
            maxLength={300}
            placeholder="Remarque (facultatif) : au cinéma, avec…"
            onChange={(e) => setNote(e.target.value)}
            aria-label="Remarque"
          />
          <button type="submit" className={`${styles.btn} ${styles.btnAccent}`} disabled={isPending}>
            {isPending ? "Ajout…" : "Ajouter"}
          </button>
          <button type="button" className={styles.btn} onClick={() => setFormOpen(false)}>
            Annuler
          </button>
        </form>
      )}

      {error && <div className={styles.error}>{error}</div>}

      {count > 0 && (
        <ul className={styles.list}>
          {watches.map((w, i) => (
            <li key={w.id} className={styles.entry}>
              <span className={styles.entryDate}>{formatWatchDate(w.watchedAt)}</span>
              {i < count - 1 && <span className={styles.rewatch}>Revu</span>}
              {w.note && <span className={styles.entryNote}>{w.note}</span>}
              <button
                type="button"
                className={styles.remove}
                disabled={isPending}
                onClick={() => run(() => deleteFilmWatch(w.id))}
                title="Retirer du journal"
                aria-label={`Retirer le visionnage du ${formatWatchDate(w.watchedAt)}`}
              >
                <X size={13} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
