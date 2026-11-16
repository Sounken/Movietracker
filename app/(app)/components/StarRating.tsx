"use client";

import { useRef, useState } from "react";
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
  /**
   * Note survolée, ou `null` quand le curseur quitte la rangée. Permet à
   * l'appelant d'afficher la prévisualisation ailleurs que dans `showValue`
   * (la fiche film/série montre le chiffre dans son propre encart).
   */
  onHoverChange?: (value: number | null) => void;
  /** Classe posée sur le conteneur, pour que l'appelant puisse l'étirer. */
  className?: string;
};

/**
 * Rangée de 10 étoiles avec demi-crans, partagée par les films, les séries et
 * les saisons. Les zones cliquables sont jointives (aucun `gap`) : un pixel
 * mort entre deux étoiles avale le clic et fait perdre le survol.
 *
 * Au doigt, on glisse sur la rangée et la note suit, dans une bulle au-dessus
 * du doigt : elle n'est enregistrée qu'au lever. Taper une demi-étoile de 10px
 * de large du premier coup était le seul moyen jusque-là, et il ratait souvent.
 */
export default function StarRating({
  value,
  onRate,
  onClear,
  size = 24,
  showValue = true,
  disabled = false,
  label,
  onHoverChange,
  className,
}: Props) {
  const scale = useRatingScale();
  // null = curseur hors de la rangée → on réaffiche la note enregistrée.
  const [hover, setHoverState] = useState<number | null>(null);
  const displayed = hover ?? value;

  // Un seul point de mise à jour : l'appelant reste toujours synchronisé.
  const setHover = (next: number | null) => {
    setHoverState(next);
    onHoverChange?.(next);
  };

  /** Moitié gauche de l'étoile = demi-point. */
  const hoverValue = (e: React.PointerEvent | React.MouseEvent, n: number) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return e.clientX - rect.left < rect.width / 2 ? n - 0.5 : n;
  };

  const commit = (next: number, isTap: boolean) => {
    setHover(null);
    if (next === value) {
      // Retaper la note déjà en place la retire, quand c'est prévu. Y revenir
      // en glissant, en revanche, ne fait rien : on a juste changé d'avis.
      if (isTap) onClear?.();
      return;
    }
    onRate(next);
  };

  // ——— Glissé au doigt ———
  const starsRef = useRef<HTMLDivElement>(null);
  /** Geste en cours : la valeur de départ sert à distinguer un tap d'un glissé. */
  const gesture = useRef<{ pointerId: number; start: number; moved: boolean } | null>(null);
  /** Le clic que le navigateur émet après un tap ne doit pas noter une 2e fois. */
  const skipClick = useRef(false);
  const [dragging, setDragging] = useState(false);

  /**
   * Note sous le doigt, calculée sur toute la rangée et non étoile par étoile :
   * le doigt peut sortir d'une étoile sans que le geste s'interrompe. Les
   * étoiles ayant toutes la même largeur, le découpage en 20 crans tombe
   * exactement sur leurs moitiés.
   */
  const valueAt = (clientX: number) => {
    const rect = starsRef.current!.getBoundingClientRect();
    const steps = Math.ceil(((clientX - rect.left) / rect.width) * 20);
    return Math.min(20, Math.max(1, steps)) / 2;
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    skipClick.current = false;
    // La souris garde le survol et le clic, plus précis qu'un glissé.
    if (e.pointerType === "mouse" || disabled) return;
    const start = valueAt(e.clientX);
    gesture.current = { pointerId: e.pointerId, start, moved: false };
    // Le doigt peut quitter la rangée (vers le haut, pour voir la bulle) sans
    // que le geste soit perdu.
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragging(true);
    setHover(start);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const g = gesture.current;
    if (!g || g.pointerId !== e.pointerId) return;
    const next = valueAt(e.clientX);
    if (next !== g.start) g.moved = true;
    if (next !== hover) setHover(next);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const g = gesture.current;
    if (!g || g.pointerId !== e.pointerId) return;
    gesture.current = null;
    skipClick.current = true;
    setDragging(false);
    commit(valueAt(e.clientX), !g.moved);
  };

  /** Le navigateur reprend la main (défilement vertical) : rien n'est noté. */
  const handlePointerCancel = () => {
    gesture.current = null;
    setDragging(false);
    setHover(null);
  };

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>, n: number) => {
    if (skipClick.current) {
      skipClick.current = false;
      return;
    }
    commit(hoverValue(e, n), true);
  };

  return (
    <div className={`${styles.wrap} ${className ?? ""}`}>
      <div
        ref={starsRef}
        className={`${styles.stars} ${disabled ? styles.disabled : ""}`}
        onPointerLeave={(e) => { if (e.pointerType === "mouse") setHover(null); }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
      >
        {/* Bulle au-dessus du doigt, qui cache les étoiles qu'il touche. */}
        {dragging && hover !== null && (
          <span
            className={styles.bubble}
            style={{ left: `clamp(22px, ${hover * 10}%, calc(100% - 22px))` }}
            aria-hidden="true"
          >
            {formatRating(hover, scale)}
          </span>
        )}
        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
          <button
            key={n}
            type="button"
            className={styles.starBtn}
            disabled={disabled}
            aria-label={`${label ? `${label} — ` : ""}noter ${toDisplayRating(n, scale)}/${scale}`}
            // Survol réservé à la vraie souris : après un tap, le navigateur
            // émule des événements souris qui laisseraient un survol figé.
            onPointerMove={(e) => { if (e.pointerType === "mouse") setHover(hoverValue(e, n)); }}
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
