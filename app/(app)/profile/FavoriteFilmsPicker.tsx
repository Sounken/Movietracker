"use client";

import { useState, useRef, useTransition } from "react";
import Image from "next/image";
import { X, Pencil } from "lucide-react";
import { setFavoriteFilm } from "@/app/actions/profile";
import styles from "./profile.module.css";

type Slot = { position: 1 | 2 | 3; tmdbId: number | null; title: string | null };

type SearchResult = { id: number; title: string; year: string | null; posterUrl: string };

export default function FavoriteFilmsPicker({ slots }: { slots: Slot[] }) {
  const [open, setOpen] = useState(false);
  const [localSlots, setLocalSlots] = useState<Slot[]>(slots);
  const [activePos, setActivePos] = useState<1 | 2 | 3 | null>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isPending, startTransition] = useTransition();
  // Position du dropdown de résultats, mesurée dans la callback de recherche
  // (jamais en lisant la ref pendant le rendu).
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const search = (q: string) => {
    setQuery(q);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!q.trim()) { setResults([]); return; }
    debounceRef.current = setTimeout(async () => {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      if (inputRef.current) {
        const r = inputRef.current.getBoundingClientRect();
        setDropdownStyle({ top: r.bottom + 4, left: r.left, width: r.width });
      }
      setResults((data as SearchResult[]).slice(0, 6));
    }, 280);
  };

  const pickFilm = (pos: 1 | 2 | 3, film: SearchResult) => {
    startTransition(async () => {
      await setFavoriteFilm(pos, film.id);
      setLocalSlots((prev) =>
        prev.map((s) =>
          s.position === pos
            ? { position: pos, tmdbId: film.id, title: film.title }
            : s.tmdbId === film.id
            ? { ...s, tmdbId: null, title: null }
            : s
        )
      );
      setActivePos(null);
      setQuery("");
      setResults([]);
    });
  };

  const removeFilm = (pos: 1 | 2 | 3) => {
    startTransition(async () => {
      await setFavoriteFilm(pos, null);
      setLocalSlots((prev) =>
        prev.map((s) => (s.position === pos ? { ...s, tmdbId: null, title: null } : s))
      );
    });
  };

  return (
    <>
      <button className={styles.pickerBtn} onClick={() => setOpen(true)}>
        Modifier les films préférés
      </button>

      {open && (
        <div
          className={styles.overlay}
          onClick={(e) => e.target === e.currentTarget && setOpen(false)}
        >
          <div className={styles.modal}>
            <button className={styles.closeBtn} onClick={() => setOpen(false)}><X size={15} /></button>
            <div className={styles.modalTitle}>Films préférés</div>

            <div className={styles.pickerSlots}>
              {localSlots.map(({ position, title }) => (
                <div key={position} className={styles.pickerSlot}>
                  <span className={styles.pickerPos}>{position}</span>
                  <div className={styles.pickerFilmInfo}>
                    {title ? (
                      <div className={styles.pickerFilmTitle}>{title}</div>
                    ) : (
                      <div className={styles.pickerFilmEmpty}>Non sélectionné</div>
                    )}
                  </div>
                  <button
                    className={styles.pickerRemove}
                    onClick={() =>
                      activePos === position
                        ? (setActivePos(null), setQuery(""), setResults([]))
                        : setActivePos(position)
                    }
                    disabled={isPending}
                    title={activePos === position ? "Annuler" : "Changer"}
                  >
                    {activePos === position ? <X size={13} /> : <Pencil size={13} />}
                  </button>
                  {title && activePos !== position && (
                    <button
                      className={styles.pickerRemove}
                      onClick={() => removeFilm(position)}
                      disabled={isPending}
                      title="Retirer"
                    >
                      <X size={13} />
                    </button>
                  )}
                </div>
              ))}
            </div>

            {activePos !== null && (
              <>
                <div className={styles.pickerSelectLabel}>
                  Choisir le film #{activePos}
                </div>
                <div className={styles.pickerSearchWrap}>
                  <input
                    ref={inputRef}
                    className={styles.pickerSearchInput}
                    placeholder="Rechercher un film…"
                    value={query}
                    onChange={(e) => search(e.target.value)}
                    autoFocus
                  />
                  {results.length > 0 && (
                    <div className={styles.pickerResults} style={dropdownStyle}>
                      {results.map((film) => (
                        <button
                          key={film.id}
                          className={styles.pickerResult}
                          onClick={() => pickFilm(activePos, film)}
                          disabled={isPending}
                        >
                          {film.posterUrl && (
                            <Image
                              src={film.posterUrl}
                              alt=""
                              className={styles.pickerResultPoster}
                              width={40}
                              height={60}
                              style={{ objectFit: "cover" }}
                            />
                          )}
                          <span className={styles.pickerResultTitle}>{film.title}</span>
                          {film.year && (
                            <span className={styles.pickerResultYear}>{film.year}</span>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
