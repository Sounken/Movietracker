"use client";

import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import styles from "./RemovedTitle.module.css";

/** Retrait d'un titre supprimé par TMDB ; l'action redirige vers la watchlist. */
export default function RemoveDeletedButton({
  tmdbId,
  remove,
}: {
  tmdbId: number;
  remove: (tmdbId: number) => Promise<void>;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <>
      <button
        type="button"
        className={styles.removeBtn}
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            try {
              await remove(tmdbId);
            } catch (e) {
              setError(e instanceof Error ? e.message : "Retrait impossible");
            }
          })
        }
      >
        <Trash2 size={14} />
        {pending ? "Retrait…" : "Retirer de ma bibliothèque"}
      </button>
      {error && <p className={styles.error}>{error}</p>}
    </>
  );
}
