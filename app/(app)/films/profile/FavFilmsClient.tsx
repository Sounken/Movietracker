"use client";

import { useState, useRef, useTransition, useCallback } from "react";
import Image from "next/image";
import { X, Pencil } from "lucide-react";
import { setFavoriteFilm } from "@/app/actions/profile";
import styles from "./profile.module.css";

type Slot = {
  position: 1 | 2 | 3 | 4;
  tmdbId: number | null;
  title: string | null;
  posterUrl: string | null;
  year: string | null;
};

type SearchResult = { id: number; title: string; year: string | null; posterUrl: string };
type SaveFn = (position: 1 | 2 | 3 | 4, tmdbId: number | null) => Promise<void>;

export default function FavFilmsClient({
  slots: initialSlots,
  save = setFavoriteFilm,
  searchType,
  noun = "film",
  nounF = false,
}: {
  slots: Slot[];
  /** Action de sauvegarde (films par défaut, ou séries) */
  save?: SaveFn;
  /** "tv" pour rechercher des séries ; sinon films */
  searchType?: "tv";
  /** nom affiché ("film" / "série") */
  noun?: string;
  /** féminin (pour les accords) */
  nounF?: boolean;
}) {
  const article = nounF ? "la" : "le";
  const un = nounF ? "une" : "un";
  const ee = nounF ? "e" : "";
  const [slots, setSlots] = useState<Slot[]>(initialSlots);
  const [editPos, setEditPos] = useState<1 | 2 | 3 | 4 | null>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isPending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const search = (q: string) => {
    setQuery(q);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!q.trim()) { setResults([]); return; }
    debounceRef.current = setTimeout(async () => {
      const res = await fetch(
        `/api/search?q=${encodeURIComponent(q)}${searchType === "tv" ? "&type=tv" : ""}`,
      );
      const data = await res.json();
      setResults((data as SearchResult[]).slice(0, 6));
    }, 280);
  };

  const pickFilm = (film: SearchResult) => {
    if (editPos === null) return;
    const pos = editPos;
    startTransition(async () => {
      await save(pos, film.id);
      setSlots((prev) =>
        prev.map((s) =>
          s.position === pos
            ? { position: pos, tmdbId: film.id, title: film.title, posterUrl: film.posterUrl, year: film.year }
            : s.tmdbId === film.id
            ? { ...s, tmdbId: null, title: null, posterUrl: null, year: null }
            : s
        )
      );
      closeSearch();
    });
  };

  const removeFilm = (pos: 1 | 2 | 3 | 4) => {
    startTransition(async () => {
      await save(pos, null);
      setSlots((prev) =>
        prev.map((s) => (s.position === pos ? { ...s, tmdbId: null, title: null, posterUrl: null, year: null } : s))
      );
    });
  };

  const closeSearch = useCallback(() => {
    setEditPos(null);
    setQuery("");
    setResults([]);
  }, []);

  return (
    <>
      <div className={styles.favsGrid}>
        {slots.map(({ position, tmdbId, title, posterUrl, year }) =>
          tmdbId ? (
            <div key={position} className={styles.favSlot}>
              <div className={styles.favBg}>
                {posterUrl && (
                  <Image
                    src={posterUrl}
                    alt=""
                    fill
                    sizes="(max-width: 768px) 50vw, 280px"
                    style={{ objectFit: "cover" }}
                  />
                )}
              </div>
              <div className={styles.favOverlay} />
              <div className={styles.favNum}>{position}</div>
              <div className={styles.favInfo}>
                <div className={styles.favTitle}>{title}</div>
                {year && <div className={styles.favMeta}>{year}</div>}
              </div>
              <div className={styles.favChange}>
                <span className={styles.favChangeLabel}>Modifier {article} {noun}</span>
                <button
                  className={styles.favChangeBtn}
                  onClick={() => setEditPos(position)}
                  disabled={isPending}
                >
                  <Pencil size={12} /> Changer
                </button>
                <button
                  className={styles.favChangeBtnAlt}
                  onClick={() => removeFilm(position)}
                  disabled={isPending}
                >
                  Retirer
                </button>
              </div>
            </div>
          ) : (
            <div key={position} className={styles.favEmptySlot} onClick={() => setEditPos(position)}>
              <div className={styles.favEmptyNum}>{position}</div>
              <div className={styles.favEmptyLabel}>Aucun{ee} {noun}</div>
              <button className={styles.favEmptyBtn} disabled={isPending}>
                + Choisir
              </button>
            </div>
          )
        )}
      </div>

      {/* Search picker modal */}
      {editPos !== null && (
        <div
          className={styles.pickerOverlay}
          onClick={(e) => e.target === e.currentTarget && closeSearch()}
        >
          <div className={styles.pickerModal}>
            <button className={styles.closeBtn} onClick={closeSearch}><X size={15} /></button>
            <div className={styles.pickerHead}>
              <h3 className={styles.pickerTitle}>
                {noun.charAt(0).toUpperCase() + noun.slice(1)} préféré{ee} #{editPos}
              </h3>
            </div>
            <div className={styles.pickerSearchWrap}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" width="15" height="15" style={{ color: "var(--ink-mute)", flexShrink: 0 }}>
                <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
              </svg>
              <input
                ref={inputRef}
                className={styles.pickerSearchInput}
                placeholder={`Rechercher ${un} ${noun}…`}
                value={query}
                onChange={(e) => search(e.target.value)}
                autoFocus
              />
            </div>
            {results.length > 0 && (
              <div className={styles.pickerList}>
                {results.map((film) => (
                  <button
                    key={film.id}
                    className={styles.pickerItem}
                    onClick={() => pickFilm(film)}
                    disabled={isPending}
                  >
                    {film.posterUrl ? (
                      <Image
                        src={film.posterUrl}
                        alt=""
                        className={styles.pickerPoster}
                        width={44}
                        height={66}
                        style={{ objectFit: "cover" }}
                      />
                    ) : (
                      <div className={styles.pickerPoster} />
                    )}
                    <div className={styles.pickerInfo}>
                      <div className={styles.pickerItemTitle}>{film.title}</div>
                      {film.year && <div className={styles.pickerItemMeta}>{film.year}</div>}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
