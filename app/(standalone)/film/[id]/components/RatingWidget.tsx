"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import StarRating from "@/app/(app)/components/StarRating";
import { useRatingScale } from "@/lib/rating-scale";
import { toDisplayRating, toStoredRating, formatRating } from "@/lib/rating";
import styles from "./RatingWidget.module.css";

type Props = {
  tmdbId: number;
  initialRating: number;
  initialReview: string;
  /** Titre de l'œuvre, utilisé dans le placeholder de l'avis. */
  title: string;
  isAuthenticated: boolean;
  /** Server Actions injectées : le même widget sert aux films et aux séries. */
  saveAction: (tmdbId: number, rating: number, review: string) => Promise<void>;
  deleteAction: (tmdbId: number) => Promise<void>;
};

export default function RatingWidget({
  tmdbId,
  initialRating,
  initialReview,
  title,
  isAuthenticated,
  saveAction,
  deleteAction,
}: Props) {
  const router = useRouter();
  const scale = useRatingScale();
  const [rating, setRating] = useState(initialRating);
  const [review, setReview] = useState(initialReview);
  const [saved, setSaved] = useState(false);
  const [isPending, startTransition] = useTransition();
  // Saisie libre sur 100 : texte tant qu'on tape, converti au blur/Entrée.
  const [draft, setDraft] = useState<string | null>(null);

  // Le survol vit désormais dans StarRating ; ici on n'affiche que l'enregistré.
  const displayed = rating;

  const handleRate = (value: number) => {
    if (!isAuthenticated) { router.push("/login"); return; }
    setRating(value);
    setSaved(false);
    startTransition(async () => {
      await saveAction(tmdbId, value, review);
      router.refresh();
    });
  };

  /** Valide la saisie du champ /100 : borne 0-100, 0 ou vide = pas de note. */
  const commitDraft = () => {
    if (draft === null) return;
    const raw = draft.trim();
    setDraft(null);
    if (raw === "") return;
    const parsed = Number(raw.replace(",", "."));
    if (Number.isNaN(parsed)) return;
    const bounded = Math.min(100, Math.max(0, parsed));
    if (bounded === 0) { handleClearRating(); return; }
    const stored = toStoredRating(bounded, 100);
    if (stored !== rating) handleRate(stored);
  };

  const handleSave = () => {
    startTransition(async () => {
      await saveAction(tmdbId, rating, review);
      setSaved(true);
      router.refresh();
    });
  };

  const handleClearRating = () => {
    setRating(0);
    setReview("");
    setSaved(false);
    startTransition(async () => {
      await deleteAction(tmdbId);
      router.refresh();
    });
  };

  return (
    <div id="rating-widget" className={styles.wrap}>
      <div className={styles.widget}>
        <div className={styles.label}>
          <strong>Votre note</strong>
          {scale === 100 ? "Cliquez ou saisissez une valeur" : "Cliquez pour noter"}
        </div>
        <div className={styles.divider} />
        <StarRating
          value={rating}
          onRate={handleRate}
          onClear={handleClearRating}
          showValue={false}
        />

        {/* Sur 100, les étoiles ne donnent que des multiples de 5 : le champ
            permet la valeur exacte (87, 93…). Sur 10, simple affichage. */}
        {scale === 100 ? (
          <div className={styles.note}>
            <input
              type="number"
              className={styles.noteInput}
              min={0}
              max={100}
              step={1}
              aria-label="Note sur 100"
              value={draft ?? (displayed > 0 ? String(toDisplayRating(displayed, 100)) : "")}
              placeholder="—"
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commitDraft}
              onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
            />
            <span className={styles.noteScale}>/100</span>
          </div>
        ) : (
          <div className={styles.note}>
            {displayed > 0 ? `${formatRating(displayed, scale)}/10` : "—"}
          </div>
        )}
      </div>

      {rating > 0 && (
        <div className={styles.reviewBlock}>
          <div className={styles.reviewLabel}>Votre avis</div>
          <textarea
            value={review}
            onChange={(e) => { setReview(e.target.value); setSaved(false); }}
            placeholder={`Qu'avez-vous pensé de "${title}" ? Partagez votre ressenti…`}
            className={styles.textarea}
          />
          <div className={styles.reviewActions}>
            {saved && <span className={styles.savedMsg}><Check size={13} /> Avis sauvegardé</span>}
            {/* Seul point de suppression depuis que le bouton « Supprimer ma
                note » de la colonne poster a disparu → libellé explicite. */}
            <button onClick={handleClearRating} disabled={isPending} className={styles.btnSecondary}>
              Supprimer ma note
            </button>
            <button onClick={handleSave} disabled={isPending} className={styles.btnSave}>
              {isPending ? "Sauvegarde…" : "Sauvegarder l'avis"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
