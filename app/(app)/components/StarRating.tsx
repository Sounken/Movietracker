"use client";

import { useState } from "react";
import { useRatingScale } from "@/lib/rating-scale";
import { toDisplayRating, formatRating } from "@/lib/rating";
import styles from "./StarRating.module.css";

// Étoiles maison (mêmes tracés que la fiche film) : lucide-react ne sait pas
// faire la demi-étoile, et son rendu diffère visuellement.
const StarFilled = ({ size }: { size: number }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" width={size} height={size}>
    <path d="m12 2 3 7 7 .5-5.5 4.5L18 22l-6-4-6 4 1.5-8L2 9.5 9 9z" />
  </svg>
);

const StarOutline = ({ size }: { size: number }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" width={size} height={size}>
    <path d="m12 2 3 7 7 .5-5.5 4.5L18 22l-6-4-6 4 1.5-8L2 9.5 9 9z" />
  </svg>
);

function StarHalf({ size }: { size: number }) {
  return (
    <span className={styles.halfWrap}>
      <span className={styles.halfFill}><StarFilled size={size} /></span>
      <StarOutline size={size} />
    </span>
  );
}

function StarIcon({ value, position, size }: { value: number; position: number; size: number }) {
  if (value >= position) return <span className={styles.on}><StarFilled size={size} /></span>;
  if (value >= position - 0.5) return <StarHalf size={size} />;
  return <span className={styles.off}><StarOutline size={size} /></span>;
}

type Props = {
  /** Note enregistrée, toujours sur 10 (0 = pas de note). */
  value: number;
  /** Reçoit la note sur 10, demi-points compris. */
  onRate: (value: number) => void;
  /** Appelé quand on reclique exactement la note déjà en place. */
  onClear?: () => void;
  size?: number;
  /** Affiche « 8.5/10 » à droite des étoiles. */
  showValue?: boolean;
  disabled?: boolean;
  /** Préfixe des aria-label, ex. « Saison 2 ». */
  label?: string;
};

/**
 * Rangée de 10 étoiles avec demi-crans, partagée par les films, les séries et
 * les saisons. Les zones cliquables sont jointives (aucun `gap`) : un pixel
 * mort entre deux étoiles avale le clic et fait perdre le survol.
 */
export default function StarRating({
  value,
  onRate,
  onClear,
  size = 24,
  showValue = true,
  disabled = false,
  label,
}: Props) {
  const scale = useRatingScale();
  // null = curseur hors de la rangée → on réaffiche la note enregistrée.
  const [hover, setHover] = useState<number | null>(null);
  const displayed = hover ?? value;

  /** Moitié gauche de l'étoile = demi-point. */
  const hoverValue = (e: React.MouseEvent<HTMLButtonElement>, n: number) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return e.clientX - rect.left < rect.width / 2 ? n - 0.5 : n;
  };

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>, n: number) => {
    const next = hoverValue(e, n);
    setHover(null);
    // Recliquer la note déjà en place la retire, quand c'est prévu.
    if (next === value && onClear) onClear();
    else onRate(next);
  };

  return (
    <div className={styles.wrap}>
      <div
        className={`${styles.stars} ${disabled ? styles.disabled : ""}`}
        onMouseLeave={() => setHover(null)}
      >
        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
          <button
            key={n}
            type="button"
            className={styles.starBtn}
            disabled={disabled}
            aria-label={`${label ? `${label} — ` : ""}noter ${toDisplayRating(n, scale)}/${scale}`}
            onMouseMove={(e) => setHover(hoverValue(e, n))}
            onClick={(e) => handleClick(e, n)}
          >
            <StarIcon value={displayed} position={n} size={size} />
          </button>
        ))}
      </div>

      {showValue && (
        <span className={styles.value}>
          {displayed > 0 ? `${formatRating(displayed, scale)}/${scale}` : "—"}
        </span>
      )}
    </div>
  );
}
