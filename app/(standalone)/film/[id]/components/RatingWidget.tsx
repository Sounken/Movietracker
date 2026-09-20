"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Sparkles } from "lucide-react";
import StarRating from "@/app/(app)/components/StarRating";
import RatingAssistant from "./RatingAssistant";
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
  /**
   * Dernier avis réellement enregistré, pour savoir si le texte a changé.
   *
   * Sans cette référence, le bouton d'enregistrement restait actif en
   * permanence et laissait croire qu'une action était attendue.
   */
  const [savedReview, setSavedReview] = useState(initialReview);
  const [isPending, startTransition] = useTransition();
  // Saisie libre sur 100 : texte tant qu'on tape, converti au blur/Entrée.
  const [draft, setDraft] = useState<string | null>(null);
  // Prévisualisation : le chiffre suit les étoiles survolées, et revient à la
  // note enregistrée dès que le curseur quitte la rangée.
  const [hover, setHover] = useState<number | null>(null);
  const [assistantOpen, setAssistantOpen] = useState(false);

  /**
   * Accusé de réception de la note.
   *
   * **La note était déjà enregistrée dès le clic sur une étoile**, mais rien ne
   * le disait : l'apparition simultanée du champ d'avis et de son bouton
   * « Sauvegarder » faisait croire qu'il fallait encore valider. Signalé à
   * l'usage. On confirme donc explicitement, et le bouton ne concerne plus que
   * le texte.
   */
  const [ratingSavedAt, setRatingSavedAt] = useState<number | null>(null);
  useEffect(() => {
    if (ratingSavedAt === null) return;
    const timer = setTimeout(() => setRatingSavedAt(null), 2600);
    return () => clearTimeout(timer);
  }, [ratingSavedAt]);

  const displayed = hover ?? rating;
  const reviewDirty = review !== savedReview;

  const handleRate = (value: number) => {
    if (!isAuthenticated) { router.push("/login"); return; }
    setRating(value);
    startTransition(async () => {
      await saveAction(tmdbId, value, review);
      // L'appel enregistre aussi le texte courant : la référence suit.
      setSavedReview(review);
      setRatingSavedAt(Date.now());
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
      setSavedReview(review);
      router.refresh();
    });
  };

  const handleClearRating = () => {
    setRating(0);
    setReview("");
    setSavedReview("");
    setRatingSavedAt(null);
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
          {ratingSavedAt !== null ? (
            <span className={styles.savedInline}><Check size={13} /> Note enregistrée</span>
          ) : (
            <>
              {scale === 100 ? "Cliquez ou saisissez une valeur" : "Cliquez pour noter"}
              <span className={styles.autoHint}> — enregistrement immédiat</span>
            </>
          )}
        </div>
        <div className={styles.divider} />
        <StarRating
          value={rating}
          onRate={handleRate}
          onClear={handleClearRating}
          onHoverChange={setHover}
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

        {/* Assistant : hésiter sur un chiffre est le cas courant, mais rien ne
            l'impose — la note reste modifiable aux étoiles juste après. */}
        <button
          type="button"
          className={styles.assistBtn}
          onClick={() => {
            if (!isAuthenticated) { router.push("/login"); return; }
            setAssistantOpen(true);
          }}
          title="Se faire aider pour fixer la note"
        >
          <Sparkles size={14} />
          M&apos;aider à noter
        </button>
      </div>

      {assistantOpen && (
        <RatingAssistant
          scale={scale}
          title={title}
          onClose={() => setAssistantOpen(false)}
          onApply={(value) => {
            setAssistantOpen(false);
            handleRate(value);
          }}
        />
      )}

      {rating > 0 && (
        <div className={styles.reviewBlock}>
          <div className={styles.reviewLabel}>Votre avis <span className={styles.optional}>— facultatif</span></div>
          <textarea
            value={review}
            onChange={(e) => setReview(e.target.value)}
            placeholder={`Qu'avez-vous pensé de "${title}" ? Partagez votre ressenti…`}
            className={styles.textarea}
          />
          <div className={styles.reviewActions}>
            {/* Seul point de suppression depuis que le bouton « Supprimer ma
                note » de la colonne poster a disparu → libellé explicite. */}
            <button onClick={handleClearRating} disabled={isPending} className={styles.btnSecondary}>
              Supprimer ma note
            </button>
            {/* Désactivé tant que le texte n'a pas changé : un bouton toujours
                actif se lit comme une validation en attente. */}
            <button
              onClick={handleSave}
              disabled={isPending || !reviewDirty}
              className={styles.btnSave}
            >
              {isPending ? "Enregistrement…" : reviewDirty ? "Enregistrer l'avis" : "Avis enregistré"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
