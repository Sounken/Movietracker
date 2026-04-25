"use client";

import { useState, useEffect, useRef, useTransition } from "react";
import { addFilm } from "@/app/actions/film";
import styles from "./AddFilmModal.module.css";

type SearchResult = { id: number; title: string; year: string; posterUrl: string; voteAverage: number | null };

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

export default function AddFilmModal({ onClose }: { onClose: () => void }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selected, setSelected] = useState<SearchResult | null>(null);

  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [review, setReview] = useState("");
  const [watched, setWatched] = useState(true);
  const [watchedAt, setWatchedAt] = useState("");
  const [isPending, startTransition] = useTransition();
  const [done, setDone] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  useEffect(() => {
    if (query.length < 2) { setResults([]); return; }
    const t = setTimeout(async () => {
      const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
      setResults(await res.json());
    }, 300);
    return () => clearTimeout(t);
  }, [query]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  const getHoverVal = (e: React.MouseEvent<HTMLButtonElement>, n: number) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return e.clientX - rect.left < rect.width / 2 ? n - 0.5 : n;
  };

  const handleSubmit = () => {
    if (!selected) return;
    startTransition(async () => {
      await addFilm({
        tmdbId: selected.id,
        rating: rating > 0 ? rating : null,
        review,
        watched,
        watchedAt: watched && watchedAt ? watchedAt : null,
      });
      setDone(true);
      setTimeout(onClose, 800);
    });
  };

  const displayed = hover || rating;

  return (
    <div className={styles.overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className={styles.modal}>
        <button className={styles.closeBtn} onClick={onClose}>✕</button>

        {!selected ? (
          /* ——— Step 1: Search ——— */
          <>
            <div className={styles.modalTitle}>Ajouter un film</div>
            <div className={styles.searchWrap}>
              <svg className={styles.searchIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" width="16" height="16">
                <circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" />
              </svg>
              <input
                ref={inputRef}
                className={styles.searchInput}
                placeholder="Titre du film…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>

            {results.length > 0 && (
              <div className={styles.results}>
                {results.map((r) => (
                  <div key={r.id} className={styles.result} onClick={() => setSelected(r)}>
                    {r.posterUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={r.posterUrl} alt={r.title} className={styles.thumb} />
                    ) : (
                      <div className={`${styles.thumb} ${styles.thumbEmpty}`} />
                    )}
                    <div className={styles.resultInfo}>
                      <div className={styles.resultTitle}>{r.title}</div>
                      <div className={styles.resultMeta}>
                        {r.year}
                        {r.voteAverage != null && r.voteAverage > 0 && (
                          <span className={styles.resultScore}>★ {r.voteAverage}</span>
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
          /* ——— Step 2: Form ——— */
          <>
            <button className={styles.backBtn} onClick={() => setSelected(null)}>← Retour</button>

            <div className={styles.filmHeader}>
              {selected.posterUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={selected.posterUrl} alt={selected.title} className={styles.filmPoster} />
              )}
              <div>
                <div className={styles.filmTitle}>{selected.title}</div>
                {selected.year && <div className={styles.filmYear}>{selected.year}</div>}
              </div>
            </div>

            <div className={styles.field}>
              <div className={styles.fieldLabel}>Votre note</div>
              <div className={styles.stars}>
                {[1,2,3,4,5,6,7,8,9,10].map((n) => (
                  <button
                    key={n}
                    className={styles.starBtn}
                    onMouseMove={(e) => setHover(getHoverVal(e, n))}
                    onMouseLeave={() => setHover(0)}
                    onClick={(e) => setRating(getHoverVal(e, n))}
                  >
                    <StarIcon value={displayed} position={n} />
                  </button>
                ))}
                <span className={styles.ratingVal}>
                  {displayed > 0 ? `${displayed}/10` : "—"}
                </span>
              </div>
            </div>

            <div className={styles.field}>
              <div className={styles.fieldLabel}>Votre avis <span className={styles.optional}>(optionnel)</span></div>
              <textarea
                className={styles.textarea}
                value={review}
                onChange={(e) => setReview(e.target.value)}
                placeholder={`Qu'avez-vous pensé de "${selected.title}" ?`}
                rows={3}
              />
            </div>

            <div className={styles.field}>
              <label className={styles.toggle}>
                <input
                  type="checkbox"
                  checked={watched}
                  onChange={(e) => setWatched(e.target.checked)}
                  className={styles.checkbox}
                />
                <span className={styles.toggleLabel}>Film déjà vu</span>
              </label>
            </div>

            {watched && (
              <div className={styles.field}>
                <div className={styles.fieldLabel}>Date de visionnage <span className={styles.optional}>(optionnel)</span></div>
                <input
                  type="date"
                  className={styles.dateInput}
                  value={watchedAt}
                  max={new Date().toISOString().split("T")[0]}
                  onChange={(e) => setWatchedAt(e.target.value)}
                />
              </div>
            )}

            <button
              className={styles.submitBtn}
              onClick={handleSubmit}
              disabled={isPending || done}
            >
              {done ? "✓ Ajouté !" : isPending ? "Enregistrement…" : "Ajouter à ma collection"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
