"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { createList, deleteList, updateList } from "@/app/actions/lists";
import styles from "./lists.module.css";

const EMOJIS = ["🎬", "❤️", "🏆", "🌍", "👻", "✨", "🎭", "🔥", "⭐", "🌙"];
const COLORS = ["#d97742", "#7c6af7", "#e25476", "#3b9dd3", "#5ab86c", "#e8c98a"];

type ListItem = {
  id: string;
  name: string;
  description: string | null;
  emoji: string;
  color: string;
  filmCount: number;
  posters: string[];
};

export default function ListsClient({ lists }: { lists: ListItem[] }) {
  const [modalOpen, setModalOpen] = useState(false);
  const [editList, setEditList] = useState<ListItem | null>(null);
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [emoji, setEmoji] = useState("🎬");
  const [color, setColor] = useState("#d97742");
  const [isPending, startTransition] = useTransition();

  function openCreate() {
    setEditList(null);
    setName("");
    setDesc("");
    setEmoji("🎬");
    setColor("#d97742");
    setModalOpen(true);
  }

  function openEdit(list: ListItem, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setEditList(list);
    setName(list.name);
    setDesc(list.description ?? "");
    setEmoji(list.emoji);
    setColor(list.color);
    setModalOpen(true);
  }

  function handleDelete(id: string, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm("Supprimer cette liste ?")) return;
    startTransition(() => deleteList(id));
  }

  function handleSubmit() {
    if (!name.trim()) return;
    startTransition(async () => {
      if (editList) {
        await updateList(editList.id, { name, description: desc, emoji, color });
      } else {
        await createList({ name, description: desc, emoji, color });
      }
      setModalOpen(false);
    });
  }

  return (
    <>
      <div className={styles.sectionHead}>
        <div>
          <div className={styles.sectionSub}>Bibliothèque</div>
          <h2 className={styles.sectionTitle}>Mes listes</h2>
        </div>
        <button className={`${styles.pill} ${styles.pillAccent}`} onClick={openCreate}>
          + Nouvelle liste
        </button>
      </div>

      <div className={styles.listsGrid}>
        {lists.map((list) => (
          <Link key={list.id} href={`/lists/${list.id}`} className={styles.listCard}>
            <div className={styles.lcCover}>
              <div className={styles.lcMosaic}>
                {list.posters.length > 0 ? (
                  list.posters.slice(0, 3).map((url, i) => (
                    <div
                      key={i}
                      className={`${styles.lcPoster} ${i === 0 ? styles.lcPosterFirst : ""}`}
                      style={{ backgroundImage: `url(${url})` }}
                    />
                  ))
                ) : (
                  <div className={styles.lcEmpty}>
                    <span>{list.emoji}</span>
                  </div>
                )}
              </div>
              <div className={styles.lcOverlay} />
              <div className={styles.lcColorBar} style={{ background: list.color }} />
            </div>
            <div className={styles.lcBody}>
              <div className={styles.lcEmoji}>{list.emoji}</div>
              <div className={styles.lcName}>{list.name}</div>
              {list.description && <div className={styles.lcDesc}>{list.description}</div>}
              <div className={styles.lcFooter}>
                <div className={styles.lcCount}>
                  <div className={styles.lcCountDot} />
                  {list.filmCount} film{list.filmCount !== 1 ? "s" : ""}
                </div>
                <div className={styles.lcActions}>
                  <button className={styles.lcActionBtn} onClick={(e) => openEdit(list, e)} title="Modifier">
                    <PencilIcon />
                  </button>
                  <button className={styles.lcActionBtn} onClick={(e) => handleDelete(list.id, e)} title="Supprimer">
                    <TrashIcon />
                  </button>
                </div>
              </div>
            </div>
          </Link>
        ))}

        <button className={styles.listCardNew} onClick={openCreate}>
          <div className={styles.newIcon}>
            <PlusIcon />
          </div>
          <div className={styles.newLabel}>Nouvelle liste</div>
          <div className={styles.newSub}>Organise tes films</div>
        </button>
      </div>

      {modalOpen && (
        <div className={styles.modalBg} onClick={() => setModalOpen(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h3>{editList ? "Modifier la liste" : "Créer une liste"}</h3>
            <div className={styles.field}>
              <label>Nom</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ma liste de films"
                autoFocus
              />
            </div>
            <div className={styles.field}>
              <label>Description (optionnel)</label>
              <textarea
                value={desc}
                onChange={(e) => setDesc(e.target.value)}
                placeholder="Une courte description..."
              />
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
              <button className={styles.btnCancel} onClick={() => setModalOpen(false)}>
                Annuler
              </button>
              <button
                className={styles.btnCreate}
                onClick={handleSubmit}
                disabled={isPending || !name.trim()}
              >
                {editList ? "Enregistrer" : "Créer"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

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

const PlusIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);
