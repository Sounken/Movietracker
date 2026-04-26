"use client";

import { useState, useTransition } from "react";
import { saveRating, deleteRating } from "@/app/actions/film";
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

type Props = { tmdbId: number; initialRating: number; initialReview: string; filmTitle: string };

export default function RatingWidget({ tmdbId, initialRating, initialReview, filmTitle }: Props) {
  const [rating, setRating] = useState(initialRating);
  const [hover, setHover] = useState(0);
  const [review, setReview] = useState(initialReview);
  const [saved, setSaved] = useState(false);
  const [isPending, startTransition] = useTransition();

  const displayed = hover || rating;

  const getHoverValue = (e: React.MouseEvent<HTMLButtonElement>, n: number) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return e.clientX - rect.left < rect.width / 2 ? n - 0.5 : n;
  };

  const handleRate = (value: number) => {
    setRating(value);
    setSaved(false);
    startTransition(async () => { await saveRating(tmdbId, value, review); });
  };

  const handleDelete = () => {
    setRating(0);
    setReview("");
    setSaved(false);
    startTransition(async () => { await deleteRating(tmdbId); });
  };

  const handleSave = () => {
    startTransition(async () => {
      await saveRating(tmdbId, rating, review);
      setSaved(true);
    });
  };

  return (
    <div className={styles.wrap}>
      <div className={styles.widget}>
        <div className={styles.label}>
          <strong>Votre note</strong>
          Cliquez pour noter
        </div>
        <div className={styles.divider} />
        <div className={styles.stars}>
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
            <button
              key={n}
              className={styles.starBtn}
              onMouseMove={(e) => setHover(getHoverValue(e, n))}
              onMouseLeave={() => setHover(0)}
              onClick={(e) => handleRate(getHoverValue(e, n))}
            >
              <StarIcon value={displayed} position={n} />
            </button>
          ))}
        </div>
        <div className={styles.note}>
          {displayed > 0 ? `${displayed}/10` : "—"}
        </div>
        {rating > 0 && (
          <button className={styles.btnDelete} onClick={handleDelete} disabled={isPending} title="Supprimer ma note">
            × Supprimer
          </button>
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
            {saved && <span className={styles.savedMsg}>✓ Avis sauvegardé</span>}
            <button onClick={() => { setReview(""); setSaved(false); }} className={styles.btnSecondary}>Effacer</button>
            <button onClick={handleSave} disabled={isPending} className={styles.btnSave}>
              {isPending ? "Sauvegarde…" : "Sauvegarder l'avis"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
