"use client";

import { useEffect } from "react";
import { X, Lock, Check, Sparkles } from "lucide-react";
import type { LevelInfo, RankRow } from "@/lib/xp";
import styles from "./ranks.module.css";

export default function RanksModal({
  ranks,
  levelInfo,
  onClose,
}: {
  ranks: RankRow[];
  levelInfo: LevelInfo;
  onClose: () => void;
}) {
  // Fermeture au clavier + gel du défilement de la page derrière la modale
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [onClose]);

  return (
    <div className={styles.backdrop} onClick={onClose}>
      <div
        className={styles.modal}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Progression des rangs"
      >
        <header className={styles.head}>
          <div>
            <div className={styles.headSub}>Progression</div>
            <h2 className={styles.headTitle}>Rangs</h2>
          </div>
          <button className={styles.close} onClick={onClose} aria-label="Fermer">
            <X size={16} />
          </button>
        </header>

        {/* Résumé du rang en cours */}
        <div className={styles.current}>
          <div className={styles.currentBadge}>
            <Sparkles size={13} /> {levelInfo.title}
          </div>
          <div className={styles.currentXp}>
            {levelInfo.currentXP.toLocaleString("fr")} / {levelInfo.nextLevelXP.toLocaleString("fr")} XP
            <span className={styles.currentTotal}>
              · {levelInfo.totalXP.toLocaleString("fr")} XP au total
            </span>
          </div>
          <div className={styles.bar}>
            <div className={styles.barFill} style={{ width: `${levelInfo.percent}%` }} />
          </div>
        </div>

        <div className={styles.list}>
          {ranks.map((r) => (
            <div
              key={r.level}
              className={`${styles.rank} ${r.reached ? "" : styles.locked} ${r.current ? styles.currentRank : ""}`}
            >
              <div className={styles.rankLevel}>
                {r.reached ? (
                  r.current ? <Sparkles size={13} /> : <Check size={13} />
                ) : (
                  <Lock size={12} />
                )}
                <span>{r.level}</span>
              </div>

              <div className={styles.rankBody}>
                <div className={styles.rankTitle}>{r.title}</div>
                <div className={styles.rankXp}>
                  {r.xp === 0 ? "Dès l'inscription" : `${r.xp.toLocaleString("fr")} XP`}
                </div>
              </div>

              {r.current && <div className={styles.rankTag}>Rang actuel</div>}
            </div>
          ))}
        </div>

        <footer className={styles.foot}>
          Gagnez de l&apos;XP en notant (+15), en écrivant un avis (+20), en marquant
          un titre comme vu (+8) et en ajoutant un coup de cœur (+5).
        </footer>
      </div>
    </div>
  );
}
