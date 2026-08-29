"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X, ChevronDown, Minus, Plus } from "lucide-react";
import {
  CRITERIA,
  GROUPS,
  LEVELS,
  PRESETS,
  CUSTOM_CAP,
  computeAssistant,
  initialState,
  snapToScale,
  type AdjustmentKind,
  type AssistantState,
  type CriterionGroup,
} from "@/lib/rating-assistant";
import { formatRating } from "@/lib/rating";
import type { RatingScale } from "@/lib/rating";
import styles from "./RatingAssistant.module.css";

type Props = {
  scale: RatingScale;
  /** Titre de l'œuvre, rappelé en sous-titre de la modale. */
  title: string;
  /** Reçoit la note sur 10, déjà calée sur la granularité de l'échelle. */
  onApply: (rating: number) => void;
  onClose: () => void;
};

/** Une décimale, séparateur du reste de l'app (point, comme `formatRating`). */
const fmt1 = (v: number) => v.toFixed(1);

export default function RatingAssistant({ scale, title, onApply, onClose }: Props) {
  const [state, setState] = useState<AssistantState>(initialState);
  // On ouvre le premier groupe seulement : la modale tient à l'écran, et
  // l'enchaînement œuvre → expérience se fait naturellement. Les ajustements
  // restent fermés, ils sont optionnels.
  const [openGroups, setOpenGroups] = useState<CriterionGroup[]>(["head"]);
  const [openAdjust, setOpenAdjust] = useState<AdjustmentKind[]>([]);

  const result = computeAssistant(state);
  const snapped = snapToScale(result.score);

  // Échap ferme, et la page derrière ne défile plus : sans ça, la molette
  // continue de faire glisser la fiche film sous la modale.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [onClose]);

  const setLevel = (id: string, value: number) =>
    setState((s) => ({ ...s, levels: { ...s.levels, [id]: value } }));

  const togglePreset = (kind: AdjustmentKind, id: string) =>
    setState((s) => {
      const list = s[kind];
      return {
        ...s,
        [kind]: list.includes(id) ? list.filter((x) => x !== id) : [...list, id],
      };
    });

  const setCustom = (kind: AdjustmentKind, value: number) =>
    setState((s) => ({
      ...s,
      [kind === "malus" ? "customMalus" : "customBonus"]: Math.min(
        CUSTOM_CAP,
        Math.max(0, Math.round(value * 10) / 10),
      ),
    }));

  const resetAdjust = (kind: AdjustmentKind) =>
    setState((s) => ({
      ...s,
      [kind]: [],
      [kind === "malus" ? "customMalus" : "customBonus"]: 0,
    }));

  const toggle = <T,>(list: T[], value: T) =>
    list.includes(value) ? list.filter((x) => x !== value) : [...list, value];

  const modal = (
    <div
      className={styles.overlay}
      onClick={(e) => e.target === e.currentTarget && onClose()}
      role="dialog"
      aria-modal="true"
      aria-labelledby="assistant-title"
    >
      <div className={styles.modal}>
        <header className={styles.head}>
          <h2 id="assistant-title" className={styles.title}>
            {title}
          </h2>
          <button className={styles.close} onClick={onClose} aria-label="Fermer l'assistant">
            <X size={16} />
          </button>
        </header>

        <div className={styles.body}>
          {(Object.keys(GROUPS) as CriterionGroup[]).map((group) => {
            const open = openGroups.includes(group);
            const members = CRITERIA.filter((c) => c.group === group);
            const average = group === "head" ? result.head : result.heart;
            return (
              <section key={group} className={`${styles.group} ${open ? styles.open : ""}`}>
                <button
                  type="button"
                  className={styles.groupToggle}
                  aria-expanded={open}
                  onClick={() => setOpenGroups((g) => toggle(g, group))}
                >
                  <span className={styles.groupName}>{GROUPS[group].label}</span>
                  <small className={styles.groupMeta}>
                    {members.length} critères · poids {Math.round(GROUPS[group].weight * 100)}%
                  </small>
                  <b className={styles.groupScore}>{fmt1(average)}</b>
                  <ChevronDown size={14} className={styles.chevron} />
                </button>

                <div className={styles.groupBody} hidden={!open}>
                  {members.map((criterion) => (
                    <div key={criterion.id} className={styles.row}>
                      <div className={styles.rowLabel}>
                        <i className={styles.dot} />
                        {criterion.label}
                        <span className={styles.hint}>{criterion.hint}</span>
                      </div>
                      <div className={styles.segments} role="group" aria-label={criterion.label}>
                        {LEVELS.map((level) => {
                          const active = state.levels[criterion.id] === level.value;
                          return (
                            <button
                              key={level.label}
                              type="button"
                              className={`${styles.segment} ${active ? styles.segmentOn : ""}`}
                              style={{ ["--level" as string]: level.color }}
                              aria-pressed={active}
                              aria-label={`${criterion.label} : ${level.label}`}
                              onClick={() => setLevel(criterion.id, level.value)}
                            >
                              {level.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            );
          })}

          <div className={styles.adjustments}>
            {(["malus", "bonus"] as const).map((kind) => {
              const open = openAdjust.includes(kind);
              const total = kind === "malus" ? result.malus : result.bonus;
              const custom = kind === "malus" ? state.customMalus : state.customBonus;
              const selected = state[kind];
              return (
                <section
                  key={kind}
                  className={`${styles.adjust} ${styles[kind]} ${open ? styles.open : ""}`}
                >
                  <button
                    type="button"
                    className={styles.adjustToggle}
                    aria-expanded={open}
                    onClick={() => setOpenAdjust((a) => toggle(a, kind))}
                  >
                    <span className={styles.sign}>{kind === "malus" ? "−" : "+"}</span>
                    <span className={styles.adjustTitle}>
                      <b>{kind === "malus" ? "Malus" : "Bonus"}</b>
                      <small>
                        {kind === "malus"
                          ? "Ce qui a vraiment tiré le film vers le bas"
                          : "Ce qui dépasse les critères habituels"}
                      </small>
                    </span>
                    <output className={styles.adjustTotal}>
                      {kind === "malus" ? "−" : "+"}
                      {fmt1(total)}
                    </output>
                    <ChevronDown size={14} className={styles.chevron} />
                  </button>

                  <div className={styles.adjustPanel} hidden={!open}>
                    <div className={styles.presets}>
                      {PRESETS[kind].map((preset) => (
                        <button
                          key={preset.id}
                          type="button"
                          className={styles.preset}
                          aria-pressed={selected.includes(preset.id)}
                          onClick={() => togglePreset(kind, preset.id)}
                        >
                          {preset.label}
                          <span className={styles.presetWeight}>
                            {kind === "malus" ? "−" : "+"}
                            {fmt1(preset.value)}
                          </span>
                        </button>
                      ))}
                    </div>

                    <div className={styles.custom}>
                      <label htmlFor={`custom-${kind}`}>
                        {kind === "malus" ? "Autre malus" : "Autre bonus"}
                      </label>
                      <button
                        type="button"
                        className={styles.step}
                        aria-label="Diminuer"
                        onClick={() => setCustom(kind, custom - 0.1)}
                      >
                        <Minus size={13} />
                      </button>
                      <input
                        id={`custom-${kind}`}
                        type="number"
                        className={styles.customInput}
                        min={0}
                        max={CUSTOM_CAP}
                        step={0.1}
                        value={custom.toFixed(1)}
                        onChange={(e) => setCustom(kind, Number(e.target.value))}
                      />
                      <button
                        type="button"
                        className={styles.step}
                        aria-label="Augmenter"
                        onClick={() => setCustom(kind, custom + 0.1)}
                      >
                        <Plus size={13} />
                      </button>
                      <span className={styles.limit}>max {fmt1(CUSTOM_CAP)}</span>
                    </div>

                    <button
                      type="button"
                      className={styles.reset}
                      onClick={() => resetAdjust(kind)}
                    >
                      Effacer la sélection
                    </button>
                  </div>
                </section>
              );
            })}
          </div>

          {result.notices.length > 0 && (
            <p className={styles.notice}>{result.notices.join(" ")}</p>
          )}
        </div>

        <footer className={styles.footer}>
          <div className={styles.breakdown}>
            <div>
              Fabrication · 58%
              <b>{fmt1(result.head)}</b>
            </div>
            <div>
              Expérience · 42%
              <b>{fmt1(result.heart)}</b>
            </div>
            <div>
              Ajustement retenu
              <b>
                {result.delta > 0 ? "+" : ""}
                {fmt1(result.delta)}
              </b>
            </div>
          </div>

          <div className={styles.final}>
            <div className={styles.score}>
              {formatRating(snapped, scale)}
              <span className={styles.scoreScale}>/{scale}</span>
            </div>
            <button className={styles.apply} onClick={() => onApply(snapped)}>
              Appliquer {formatRating(snapped, scale)}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );

  // Portail vers `body` : rendue en place, la modale se positionnerait par
  // rapport au premier ancêtre créant un bloc conteneur (un `transform`, un
  // `filter`, une animation en cours) et non par rapport au viewport.
  return createPortal(modal, document.body);
}
