"use client";

import { useState, useEffect, useRef, useTransition } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { X, ArrowLeft, Check } from "lucide-react";
import { saveSeriesRating } from "@/app/actions/series";
import styles from "./AddFilmModal.module.css";
import { Rating, useRatingScale } from "@/lib/rating-scale";
import { toDisplayRating, toStoredRating, formatRating } from "@/lib/rating";

type SearchResult = {
  id: number;
  title: string;
  year: string;
  posterUrl: string;
  voteAverage: number | null;
};

const StarFilled = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" width="22" height="22">
    <path d="m12 2 3 7 7 .5-5.5 4.5L18 22l-6-4-6 4 1.5-8L2 9.5 9 9z" />
  </svg>
);
const StarOutline = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" width="22" height="22">
    <path d="m12 2 3 7 7 .5-5.5 4.5L18 22l-6-4-6 4 1.5-8L2 9.5 9 9z" />
  </svg>
);
function StarHalf() {
  return (
    <span className={styles.halfWrap}>
      <span className={styles.halfFill}><StarFilled /></span>
      <StarOutline />
    </span>
  );
}
function StarIcon({ value, position }: { value: number; position: number }) {
  if (value >= position) return <span style={{ color: "var(--gold)" }}><StarFilled /></span>;
  if (value >= position - 0.5) return <StarHalf />;
  return <span style={{ color: "var(--ink-mute)" }}><StarOutline /></span>;
}

export default function AddSeriesModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const scale = useRatingScale();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selected, setSelected] = useState<SearchResult | null>(null);

  const [rating, setRating] = useState(0);
  // null = curseur hors des étoiles → on réaffiche la note choisie.
  const [hover, setHover] = useState<number | null>(null);
  const [review, setReview] = useState("");
  const [isPending, startTransition] = useTransition();
  const [done, setDone] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  useEffect(() => {
    if (query.length < 2) return;
    const t = setTimeout(async () => {
      // `type=tv` : la recherche globale mélangerait films et personnes.
      const res = await fetch(`/api/search?type=tv&q=${encodeURIComponent(query)}`);
      if (res.ok) setResults(await res.json());
    }, 300);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  // Moitié gauche de l'étoile = demi-point, moitié droite = point entier.
  const getHoverVal = (e: React.MouseEvent<HTMLButtonElement>, n: number) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return e.clientX - rect.left < rect.width / 2 ? n - 0.5 : n;
  };

  const handleSubmit = () => {
    if (!selected) return;
    startTransition(async () => {
      await saveSeriesRating(selected.id, rating, review);
      setDone(true);
      router.refresh();
      setTimeout(onClose, 800);
    });
  };

  const displayed = hover ?? rating;

  return (
    <div className={styles.overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className={styles.modal}>
        <button className={styles.closeBtn} onClick={onClose}><X size={16} /></button>

        {!selected ? (
          /* ——— Étape 1 : recherche ——— */
          <>
            <div className={styles.modalTitle}>Ajouter une série</div>
            <div className={styles.searchWrap}>
              <svg className={styles.searchIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" width="16" height="16">
                <circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" />
              </svg>
              <input
                ref={inputRef}
                className={styles.searchInput}
                placeholder="Titre de la série…"
                value={query}
                onChange={(e) => {
                  const q = e.target.value;
                  setQuery(q);
                  if (q.length < 2) setResults([]);
                }}
              />
            </div>

            {results.length > 0 && (
              <div className={styles.results}>
                {results.map((r) => (
                  <div key={r.id} className={styles.result} onClick={() => setSelected(r)}>
                    {r.posterUrl ? (
                      <Image src={r.posterUrl} alt={r.title} className={styles.thumb} width={40} height={60} />
                    ) : (
                      <div className={`${styles.thumb} ${styles.thumbEmpty}`} />
                    )}
                    <div className={styles.resultInfo}>
                      <div className={styles.resultTitle}>{r.title}</div>
                      <div className={styles.resultMeta}>
                        {r.year}
                        {r.voteAverage != null && r.voteAverage > 0 && (
                          <span className={styles.resultScore}>★ <Rating value={r.voteAverage} /></span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {query.length >= 2 && results.length === 0 && (
              <div className={styles.empty}>Aucun résultat</div>
            )}
          </>
        ) : (
          /* ——— Étape 2 : note + avis ——— */
          <>
            <button className={styles.backBtn} onClick={() => setSelected(null)}>
              <ArrowLeft size={13} /> Retour
            </button>

            <div className={styles.filmHeader}>
              {selected.posterUrl && (
                <Image src={selected.posterUrl} alt={selected.title} className={styles.filmPoster} width={56} height={84} />
              )}
              <div>
                <div className={styles.filmTitle}>{selected.title}</div>
                {selected.year && <div className={styles.filmYear}>{selected.year}</div>}
              </div>
            </div>

            <div className={styles.field}>
              <div className={styles.fieldLabel}>Votre note</div>
              <div className={styles.stars} onMouseLeave={() => setHover(null)}>
                {[1,2,3,4,5,6,7,8,9,10].map((n) => (
                  <button
                    key={n}
                    className={styles.starBtn}
                    aria-label={`Noter ${toDisplayRating(n, scale)}/${scale}`}
                    onMouseMove={(e) => setHover(getHoverVal(e, n))}
                    onClick={(e) => { setRating(getHoverVal(e, n)); setHover(null); }}
                  >
                    <StarIcon value={displayed} position={n} />
                  </button>
                ))}
                {/* Sur 100 : saisie exacte, les étoiles ne font que des pas de 5. */}
                {scale === 100 ? (
                  <span className={styles.ratingVal}>
                    <input
                      type="number"
                      className={styles.ratingInput}
                      min={0}
                      max={100}
                      step={1}
                      aria-label="Note sur 100"
                      placeholder="—"
                      value={rating > 0 ? String(toDisplayRating(rating, 100)) : ""}
                      onChange={(e) => {
                        const raw = e.target.value;
                        if (raw === "") { setRating(0); return; }
                        const n = Number(raw);
                        if (Number.isNaN(n)) return;
                        setRating(toStoredRating(Math.min(100, Math.max(0, n)), 100));
                      }}
                    />
                    /100
                  </span>
                ) : (
                  <span className={styles.ratingVal}>
                    {displayed > 0 ? `${formatRating(displayed, scale)}/10` : "—"}
                  </span>
                )}
              </div>
            </div>

            <div className={styles.field}>
              <div className={styles.fieldLabel}>
                Votre avis <span className={styles.optional}>(optionnel)</span>
              </div>
              <textarea
                className={styles.textarea}
                value={review}
                onChange={(e) => setReview(e.target.value)}
                placeholder={`Qu'avez-vous pensé de "${selected.title}" ?`}
                rows={3}
              />
            </div>

            <button
              className={styles.submitBtn}
              onClick={handleSubmit}
              disabled={isPending || done || rating === 0}
            >
              {done
                ? <><Check size={15} /> Ajoutée !</>
                : isPending
                  ? "Enregistrement…"
                  : rating === 0
                    ? "Choisissez une note"
                    : "Ajouter à ma collection"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
