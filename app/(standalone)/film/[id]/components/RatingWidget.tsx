"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { saveRating, deleteRating } from "@/app/actions/film";
import { useRatingScale } from "@/lib/rating-scale";
import { toDisplayRating, toStoredRating, formatRating } from "@/lib/rating";
import styles from "./RatingWidget.module.css";

// Full star
const StarFilled = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" width="24" height="24">
    <path d="m12 2 3 7 7 .5-5.5 4.5L18 22l-6-4-6 4 1.5-8L2 9.5 9 9z" />
  </svg>
);

// Outline star
const StarOutline = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" width="24" height="24">
    <path d="m12 2 3 7 7 .5-5.5 4.5L18 22l-6-4-6 4 1.5-8L2 9.5 9 9z" />
  </svg>
);

// Half star: filled left half over an outline
function StarHalf() {
  return (
    <span className={styles.halfWrap}>
      <span className={styles.halfFill}><StarFilled /></span>
      <StarOutline />
    </span>
  );
}

const GOLD = "var(--gold)";
const MUTED = "var(--ink-mute)";

function StarIcon({ value, position }: { value: number; position: number }) {
  if (value >= position) return <span style={{ color: GOLD }}><StarFilled /></span>;
  if (value >= position - 0.5) return <StarHalf />;
  return <span style={{ color: MUTED }}><StarOutline /></span>;
}

type Props = { tmdbId: number; initialRating: number; initialReview: string; filmTitle: string; isAuthenticated: boolean };

export default function RatingWidget({ tmdbId, initialRating, initialReview, filmTitle, isAuthenticated }: Props) {
  const router = useRouter();
  const scale = useRatingScale();
  const [rating, setRating] = useState(initialRating);
  // null = le curseur n'est pas sur les étoiles → on affiche la note enregistrée.
  const [hover, setHover] = useState<number | null>(null);
  const [review, setReview] = useState(initialReview);
  const [saved, setSaved] = useState(false);
  const [isPending, startTransition] = useTransition();
  // Saisie libre sur 100 : texte tant qu'on tape, converti au blur/Entrée.
  const [draft, setDraft] = useState<string | null>(null);

  const displayed = hover ?? rating;

  const getHoverValue = (e: React.MouseEvent<HTMLButtonElement>, n: number) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return e.clientX - rect.left < rect.width / 2 ? n - 0.5 : n;
  };

  const handleRate = (value: number) => {
    if (!isAuthenticated) { router.push("/login"); return; }
    setRating(value);
    // On repasse sur la note enregistrée immédiatement : sans ça, le survol
    // resté « collé » sur une autre étoile laissait croire à une autre note.
    setHover(null);
    setSaved(false);
    startTransition(async () => {
      await saveRating(tmdbId, value, review);
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
      await saveRating(tmdbId, rating, review);
      setSaved(true);
      router.refresh();
    });
  };

  const handleClearRating = () => {
    setRating(0);
    setHover(null);
    setReview("");
    setSaved(false);
    startTransition(async () => {
      await deleteRating(tmdbId);
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
        {/* Le mouseleave est sur le conteneur, pas sur chaque étoile : sortir
            de la rangée réinitialise le survol de façon fiable, même en
            passant entre deux étoiles ou en sortant très vite. */}
        <div className={styles.stars} onMouseLeave={() => setHover(null)}>
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
            <button
              key={n}
              className={styles.starBtn}
              aria-label={`Noter ${toDisplayRating(n, scale)}/${scale}`}
              onMouseMove={(e) => setHover(getHoverValue(e, n))}
              onClick={(e) => handleRate(getHoverValue(e, n))}
            >
              <StarIcon value={displayed} position={n} />
            </button>
          ))}
        </div>

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
            placeholder={`Qu'avez-vous pensé de "${filmTitle}" ? Partagez votre ressenti…`}
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
