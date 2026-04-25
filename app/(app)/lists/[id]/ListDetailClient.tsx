"use client";

import { useState, useTransition, useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { updateList, deleteList, addFilmToList, removeFilmFromList } from "@/app/actions/lists";
import styles from "../lists.module.css";

const EMOJIS = ["🎬", "❤️", "🏆", "🌍", "👻", "✨", "🎭", "🔥", "⭐", "🌙"];
const COLORS = ["#d97742", "#7c6af7", "#e25476", "#3b9dd3", "#5ab86c", "#e8c98a"];

type ListMeta = {
  id: string;
  name: string;
  description: string | null;
  emoji: string;
  color: string;
  filmCount: number;
  createdAt: string;
};

type FilmItem = {
  id: number;
  title: string;
  posterUrl: string;
  year: string;
  tmdbId: number;
};

type SearchResult = {
  id: number;
  title: string;
  year: string;
  posterUrl: string;
};

export default function ListDetailClient({ list, films: initialFilms }: { list: ListMeta; films: FilmItem[] }) {
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [name, setName] = useState(list.name);
  const [desc, setDesc] = useState(list.description ?? "");
  const [emoji, setEmoji] = useState(list.emoji);
  const [color, setColor] = useState(list.color);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [addedIds, setAddedIds] = useState<Set<number>>(new Set(initialFilms.map((f) => f.tmdbId)));
  const [isPending, startTransition] = useTransition();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const search = useCallback((q: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!q.trim()) { setResults([]); return; }
    debounceRef.current = setTimeout(async () => {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
      if (res.ok) setResults(await res.json());
    }, 300);
  }, []);

  useEffect(() => { search(query); }, [query, search]);

  function handleEditSubmit() {
    if (!name.trim()) return;
    startTransition(async () => {
      await updateList(list.id, { name, description: desc, emoji, color });
      setEditOpen(false);
      router.refresh();
    });
  }

  function handleDelete() {
    if (!confirm("Supprimer cette liste définitivement ?")) return;
    startTransition(async () => {
      await deleteList(list.id);
      router.push("/lists");
    });
  }

  function handleAdd(tmdbId: number) {
    setAddedIds((prev) => new Set([...prev, tmdbId]));
    startTransition(() => addFilmToList(list.id, tmdbId));
  }

  function handleRemove(tmdbId: number) {
    if (!confirm("Retirer ce film de la liste ?")) return;
    startTransition(() => removeFilmFromList(list.id, tmdbId));
    router.refresh();
  }

  const year = new Date(list.createdAt).getFullYear();

  return (
    <>
      <button className={styles.detailBack} onClick={() => router.push("/lists")}>
        <ChevronIcon />
        Mes listes
      </button>

      <div className={styles.detailHeader}>
        <div className={styles.detailIcon}>{emoji}</div>
        <div className={styles.detailInfo}>
          <h1 className={styles.detailName}>{name}</h1>
          {desc && <p className={styles.detailDescText}>{desc}</p>}
          <div className={styles.detailMeta}>
            <div className={styles.detailChip}>
              <FilmIcon />
              {list.filmCount} film{list.filmCount !== 1 ? "s" : ""}
            </div>
            <div className={styles.detailChip}>
              <CalendarIcon />
              Créée en {year}
            </div>
          </div>
        </div>
        <div className={styles.detailActions}>
          <button className={styles.btnAddFilm} onClick={() => setPickerOpen(true)}>
            <PlusIcon />
            Ajouter un film
          </button>
          <button className={styles.btnGhost} onClick={() => setEditOpen(true)}>
            <PencilIcon />
            Modifier
          </button>
          <button className={`${styles.btnGhost} ${styles.btnGhostDanger}`} onClick={handleDelete}>
            <TrashIcon />
            Supprimer
          </button>
        </div>
      </div>

      {initialFilms.length === 0 ? (
        <div className={styles.listEmpty}>
          <div className={styles.leEmoji}>🎞️</div>
          <div className={styles.leTitle}>Aucun film pour l&apos;instant</div>
          <div className={styles.leSub}>Ajoute des films à cette liste</div>
          <button className={styles.btnAddFilm} onClick={() => setPickerOpen(true)}>
            <PlusIcon />
            Ajouter un film
          </button>
        </div>
      ) : (
        <div className={styles.filmGrid}>
          {initialFilms.map((film) => (
            <div key={film.tmdbId} className={styles.filmCard}>
              <div
                className={styles.fcPoster}
                style={film.posterUrl ? { backgroundImage: `url(${film.posterUrl})` } : {}}
              >
                <div className={styles.fcQuick}>
                  <button className={styles.fcQuickBtn} onClick={() => handleRemove(film.tmdbId)}>
                    Retirer
                  </button>
                </div>
              </div>
              <div className={styles.fcInfo}>
                <div className={styles.fcTitle}>{film.title}</div>
                <div className={styles.fcMeta}>{film.year}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Edit modal */}
      {editOpen && (
        <div className={styles.modalBg} onClick={() => setEditOpen(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h3>Modifier la liste</h3>
            <div className={styles.field}>
              <label>Nom</label>
              <input value={name} onChange={(e) => setName(e.target.value)} autoFocus />
            </div>
            <div className={styles.field}>
              <label>Description (optionnel)</label>
              <textarea value={desc} onChange={(e) => setDesc(e.target.value)} />
            </div>
            <div className={styles.field}>
              <label>Emoji</label>
              <div className={styles.emojiRow}>
                {EMOJIS.map((em) => (
                  <button
                    key={em}
                    className={`${styles.emBtn} ${emoji === em ? styles.emBtnOn : ""}`}
                    onClick={() => setEmoji(em)}
                  >
                    {em}
                  </button>
                ))}
              </div>
            </div>
            <div className={styles.field}>
              <label>Couleur</label>
              <div className={styles.colorRow}>
                {COLORS.map((c) => (
                  <button
                    key={c}
                    className={`${styles.colSwatch} ${color === c ? styles.colSwatchOn : ""}`}
                    style={{ background: c }}
                    onClick={() => setColor(c)}
                  />
                ))}
              </div>
            </div>
            <div className={styles.modalFooter}>
              <button className={styles.btnCancel} onClick={() => setEditOpen(false)}>Annuler</button>
              <button className={styles.btnCreate} onClick={handleEditSubmit} disabled={isPending || !name.trim()}>
                Enregistrer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Film picker */}
      {pickerOpen && (
        <div className={styles.fpickerBg} onClick={() => setPickerOpen(false)}>
          <div className={styles.fpicker} onClick={(e) => e.stopPropagation()}>
            <div className={styles.fpickerHead}>
              <h3>Ajouter un film</h3>
              <button className={styles.fpickerClose} onClick={() => setPickerOpen(false)}>
                <XIcon />
              </button>
            </div>
            <div className={styles.fpickerSearch}>
              <SearchIcon />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Rechercher un film..."
                autoFocus
              />
            </div>
            <div className={styles.fpickerList}>
              {results.length === 0 && query.length > 1 && (
                <div className={styles.fpickerEmpty}>Aucun résultat</div>
              )}
              {results.length === 0 && query.length <= 1 && (
                <div className={styles.fpickerEmpty}>Tape le titre d&apos;un film…</div>
              )}
              {results.map((film) => {
                const already = addedIds.has(film.id);
                return (
                  <div key={film.id} className={styles.fpickerItem}>
                    <div
                      className={styles.fpPoster}
                      style={film.posterUrl ? { backgroundImage: `url(${film.posterUrl})` } : {}}
                    />
                    <div className={styles.fpInfo}>
                      <div className={styles.fpTitle}>{film.title}</div>
                      <div className={styles.fpMeta}>{film.year}</div>
                    </div>
                    {already ? (
                      <span className={styles.fpAdded}>✓ Ajouté</span>
                    ) : (
                      <button className={styles.fpAddBtn} onClick={() => handleAdd(film.id)}>
                        <PlusIcon />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

const ChevronIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M15 18l-6-6 6-6" />
  </svg>
);
const PlusIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
    <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);
const PencilIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
  </svg>
);
const TrashIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
    <path d="M10 11v6M14 11v6" />
    <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
  </svg>
);
const FilmIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
    <rect x="3" y="4" width="18" height="16" rx="2" />
    <path d="M3 9h18M3 15h18M8 4v16M16 4v16" />
  </svg>
);
const CalendarIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
    <rect x="3" y="4" width="18" height="18" rx="2" />
    <path d="M16 2v4M8 2v4M3 10h18" />
  </svg>
);
const SearchIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
    <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
  </svg>
);
const XIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);
