"use client";

import { useEffect, useId, useRef, useState, useTransition, type KeyboardEvent } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowUp, ArrowDown, Check, Lock, Lightbulb, Search as SearchGlyph } from "lucide-react";
import { submitGuess, type PuzzleState } from "@/app/actions/puzzle";
import type { Cell, PuzzleMedia } from "@/lib/puzzle";
import styles from "./PuzzleBoard.module.css";

type Suggestion = { tmdbId: number; title: string; year: number; posterUrl: string };

/**
 * Largeur de chaque colonne de la grille, selon ce qu'elle contient.
 *
 * À parts égales, « Têtes d'affiche » s'étirait sur cinq lignes pendant que
 * l'année ou la note flottaient dans une case trop large : les chiffres
 * cèdent de la place aux listes de noms.
 */
const NUMERIC_COLUMNS = new Set(["year", "runtime", "seasons", "rating"]);

function columnTemplate(keys: string[]): string {
  const cols = keys.map((key) =>
    NUMERIC_COLUMNS.has(key)
      ? "minmax(78px, 0.8fr)"
      : key === "actors"
        ? "minmax(110px, 1.6fr)"
        : "minmax(86px, 1fr)",
  );
  return ["minmax(150px, 1.4fr)", ...cols].join(" ");
}

/**
 * Ordre des tuiles sur téléphone : les chiffres d'abord, sur une même ligne,
 * puis les critères textuels deux par deux, et les têtes d'affiche — la liste
 * la plus longue — en pleine largeur à la fin.
 */
function mobileOrder(cells: Cell[]): Cell[] {
  const rank = (c: Cell) => (NUMERIC_COLUMNS.has(c.key) ? 0 : c.key === "actors" ? 2 : 1);
  return [...cells].sort((a, b) => rank(a) - rank(b));
}

function tileSpan(key: string): string {
  return NUMERIC_COLUMNS.has(key) ? styles.tileThird : key === "actors" ? styles.tileFull : styles.tileHalf;
}

function Arrow({ direction }: { direction?: Cell["direction"] }) {
  if (direction === "higher") return <ArrowUp size={13} />;
  if (direction === "lower") return <ArrowDown size={13} />;
  return null;
}

/**
 * Grille du Moviedle.
 *
 * L'état complet vient du serveur à chaque proposition : c'est lui qui détient
 * la réponse et recompose les lignes. Le composant ne calcule aucune couleur,
 * il les affiche.
 */
export default function PuzzleBoard({
  media,
  initial,
  streak,
  guest = false,
}: {
  media: PuzzleMedia;
  initial: PuzzleState;
  streak: number;
  /** Visiteur sans compte : sa partie vit dans un cookie, sans série de victoires. */
  guest?: boolean;
}) {
  const [state, setState] = useState<PuzzleState>(initial);
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [error, setError] = useState<string | null>(null);
  // Suggestion surlignée au clavier, repérée par identifiant et non par
  // position : quand la liste change sous les doigts du joueur, un index
  // pointerait sur un autre titre, alors qu'un identifiant absent de la
  // nouvelle liste ne surligne simplement plus rien.
  const [activeId, setActiveId] = useState<number | null>(null);
  // Lignes déjà là au chargement : elles ne rejouent pas la révélation, seule
  // une proposition faite pendant la visite se dévoile colonne par colonne.
  const [initialIds] = useState(() => new Set(initial.guesses.map((g) => g.tmdbId)));
  const [pending, startTransition] = useTransition();
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const listId = useId();
  // Un indice débloqué reste caché jusqu'au clic : le joueur qui veut trouver
  // seul ne doit pas se le voir imposer en arrivant à son troisième essai.
  const [revealed, setRevealed] = useState<Set<string>>(() => new Set());

  const played = new Set(state.guesses.map((g) => g.tmdbId));

  // Autocomplétion : une requête par pause de frappe, comme la recherche de
  // la collection.
  useEffect(() => {
    // Pas de `setSuggestions([])` ici : vider l'état depuis un effet déclenche
    // un rendu en cascade (et le lint du projet le refuse). Champ vide : on
    // n'interroge rien et l'affichage est filtré plus bas.
    if (query.trim().length < 1) return;
    const id = setTimeout(async () => {
      const res = await fetch(
        `/api/puzzle/search?media=${media}&q=${encodeURIComponent(query.trim())}`,
      );
      if (!res.ok) return;
      const data = await res.json();
      setSuggestions(data.results ?? []);
    }, 250);
    return () => clearTimeout(id);
  }, [query, media]);

  useEffect(() => {
    const onPointer = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setSuggestions([]);
    };
    document.addEventListener("mousedown", onPointer);
    return () => document.removeEventListener("mousedown", onPointer);
  }, []);

  function play(tmdbId: number) {
    setQuery("");
    setSuggestions([]);
    setActiveId(null);
    setError(null);
    startTransition(async () => {
      try {
        setState(await submitGuess(media, tmdbId));
      } catch (e) {
        setError(e instanceof Error ? e.message : "Proposition refusée");
      }
    });
  }

  const noun = media === "movie" ? "film" : "série";
  // « le film » mais « la série » : sans ça le titre de la page est fautif.
  const determiner = media === "movie" ? "le" : "la";
  // Champ vidé : les résultats encore en mémoire seraient ceux de la frappe
  // précédente, on ne les montre pas.
  const visible = query.trim().length >= 1 ? suggestions : [];
  const selectable = visible.filter((s) => !played.has(s.tmdbId));
  const active = selectable.find((s) => s.tmdbId === activeId) ?? null;
  const optionId = (tmdbId: number) => `${listId}-${tmdbId}`;

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") {
      setSuggestions([]);
      setActiveId(null);
      return;
    }
    if (e.key === "Enter") {
      // Sans suggestion surlignée, Entrée ne joue rien : une proposition ne se
      // reprend pas, elle ne doit pas partir sur le premier titre venu.
      if (active) {
        e.preventDefault();
        play(active.tmdbId);
      }
      return;
    }
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    if (selectable.length === 0) return;
    e.preventDefault();
    const current = active ? selectable.indexOf(active) : -1;
    const step = e.key === "ArrowDown" ? 1 : -1;
    // Premier appui vers le haut : on part de la fin, comme un menu natif.
    const next =
      current === -1
        ? step === 1
          ? 0
          : selectable.length - 1
        : (current + step + selectable.length) % selectable.length;
    const target = selectable[next];
    setActiveId(target.tmdbId);
    // L'option existe déjà dans le DOM (seul son surlignage change) : on peut
    // la faire défiler tout de suite, sans attendre le rendu.
    document.getElementById(optionId(target.tmdbId))?.scrollIntoView({ block: "nearest" });
  }

  return (
    <div className={styles.board}>
      <div className={styles.head}>
        <div>
          <div className={styles.sectionSub}>Grille du jour</div>
          <h2 className={styles.title}>
            {state.solved
              ? `Trouvé en ${state.guesses.length} essai${state.guesses.length > 1 ? "s" : ""}`
              : `Devinez ${determiner} ${noun} du jour`}
          </h2>
        </div>
        {streak > 0 && (
          <div className={styles.streak}>
            {streak} jour{streak > 1 ? "s" : ""} d&apos;affilée
          </div>
        )}
      </div>

      {!state.available ? (
        /* Vivier vide : sans ce message, la recherche ne renvoie jamais rien
           et l'écran passe pour cassé — c'est ce qu'on a vu au premier
           déploiement, avant le remplissage. */
        <div className={styles.unavailable}>
          <strong>Aucune grille pour aujourd&apos;hui.</strong> Le catalogue du jeu n&apos;est
          pas encore rempli — repassez d&apos;ici peu.
        </div>
      ) : state.solved ? (
        <div className={styles.win}>
          {state.answer?.posterUrl && (
            <Image
              src={state.answer.posterUrl}
              alt=""
              width={64}
              height={96}
              className={styles.winPoster}
              style={{ height: "auto" }}
            />
          )}
          <div>
            <div className={styles.winLabel}>
              <Check size={14} /> Bravo
            </div>
            <div className={styles.winTitle}>
              {state.answer?.title} <span>({state.answer?.year})</span>
            </div>
            <div className={styles.winHint}>Prochaine grille demain à minuit.</div>
            {guest && (
              <div className={styles.winHint}>
                <Link href="/register" className={styles.winLink}>
                  Créez un compte
                </Link>{" "}
                pour garder votre série de victoires.
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className={styles.searchBlock}>
          <p className={styles.instruction}>
            {state.guesses.length === 0
              ? `Écrivez un ${noun} pour commencer.`
              : `Écrivez un autre ${noun} pour affiner.`}
          </p>
          <div className={styles.searchWrap} ref={wrapRef}>
            <SearchGlyph size={15} className={styles.searchIcon} />
            <input
              className={styles.searchInput}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder={`Proposer un ${noun}…`}
              disabled={pending}
              aria-label={`Proposer un ${noun}`}
              role="combobox"
              aria-autocomplete="list"
              aria-expanded={visible.length > 0}
              aria-controls={listId}
              aria-activedescendant={active ? optionId(active.tmdbId) : undefined}
            />
            {visible.length > 0 && (
              <ul id={listId} role="listbox" className={styles.suggestions}>
                {visible.map((s) => {
                  const already = played.has(s.tmdbId);
                  const isActive = s.tmdbId === active?.tmdbId;
                  return (
                    // Des options plutôt que des boutons : le focus reste dans
                    // le champ, et c'est `aria-activedescendant` qui annonce
                    // la suggestion surlignée au lecteur d'écran.
                    <li
                      key={s.tmdbId}
                      id={optionId(s.tmdbId)}
                      role="option"
                      aria-selected={isActive}
                      aria-disabled={already}
                      className={`${styles.suggestion} ${isActive ? styles.suggestionActive : ""}`}
                      // `mousedown` empêché : sinon le champ perd le focus avant
                      // le clic et le joueur doit y revenir pour continuer.
                      onMouseDown={(e) => e.preventDefault()}
                      onMouseEnter={() => !already && setActiveId(s.tmdbId)}
                      onClick={() => !already && play(s.tmdbId)}
                      // Un titre déjà joué reste visible mais inerte : le
                      // masquer laisserait croire qu'il n'est pas dans le jeu.
                      title={already ? "Déjà proposé" : undefined}
                    >
                      {s.posterUrl ? (
                        <Image src={s.posterUrl} alt="" width={28} height={42} style={{ height: "auto" }} />
                      ) : (
                        <span className={styles.suggestionBlank} />
                      )}
                      <span className={styles.suggestionTitle}>{s.title}</span>
                      <span className={styles.suggestionYear}>{s.year}</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {state.hints.length > 0 && (
            <div className={styles.hints}>
              {state.hints.map((h) => {
                if (h.value === null) {
                  const left = h.unlockAt - state.guesses.length;
                  return (
                    <div key={h.key} className={`${styles.hint} ${styles.hintLocked}`}>
                      <Lock size={12} />
                      <span>
                        {h.label} · dans {left} essai{left > 1 ? "s" : ""}
                      </span>
                    </div>
                  );
                }
                if (!revealed.has(h.key)) {
                  return (
                    <button
                      key={h.key}
                      type="button"
                      className={`${styles.hint} ${styles.hintReady}`}
                      onClick={() => setRevealed((prev) => new Set(prev).add(h.key))}
                    >
                      <Lightbulb size={12} />
                      <span>Indice : {h.label.toLowerCase()}</span>
                    </button>
                  );
                }
                return (
                  <div key={h.key} className={`${styles.hint} ${styles.hintOpen}`}>
                    <span className={styles.hintLabel}>{h.label}</span>
                    <strong>{h.value}</strong>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {error && <div className={styles.error}>{error}</div>}

      {!state.available ? null : state.guesses.length === 0 ? (
        <div className={styles.empty}>
          Proposez n&apos;importe quel {noun} connu : chacune de ses colonnes se compare
          à celui du jour. <span className={styles.legendHit}>Vert</span> = identique,{" "}
          <span className={styles.legendPartial}>orange</span> = proche ou partiellement
          commun, <span className={styles.legendMiss}>gris</span> = rien en commun. Sur les
          colonnes chiffrées, la flèche indique si le {noun} cherché est au-dessus ou
          en dessous. Aucune limite d&apos;essais, et des indices se débloquent au fil
          des propositions.
        </div>
      ) : (
        <div className={styles.gridScroll}>
          <div
            className={styles.grid}
            style={{
              ["--template" as string]: columnTemplate(state.guesses[0].cells.map((c) => c.key)),
            }}
          >
            <div className={styles.rowHead}>
              <div className={styles.cellHead}>{media === "movie" ? "Film" : "Série"}</div>
              {state.guesses[0].cells.map((c) => (
                <div key={c.key} className={styles.cellHead}>
                  {c.label}
                </div>
              ))}
            </div>
            {state.guesses.map((g) => (
              <div
                key={g.tmdbId}
                className={`${styles.row} ${initialIds.has(g.tmdbId) ? "" : styles.fresh}`}
              >
                <div className={styles.cellTitle}>
                  {g.posterUrl && (
                    <Image src={g.posterUrl} alt="" width={28} height={42} style={{ height: "auto" }} />
                  )}
                  <span>{g.title}</span>
                </div>
                {g.cells.map((c, i) => (
                  <div
                    key={c.key}
                    className={`${styles.cell} ${styles[c.state]}`}
                    style={{ ["--i" as string]: i }}
                  >
                    <span>{c.value}</span>
                    <Arrow direction={c.direction} />
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Téléphone : une carte par proposition au lieu d'une ligne de tableau.
          Huit colonnes imposaient un défilement horizontal où l'on perdait le
          titre de vue ; ici tout se lit d'un coup d'œil, en défilant vers le
          bas. Les deux vues sont rendues, le CSS choisit — pas de détection de
          largeur en JS, donc pas d'écart entre rendu serveur et client. */}
      {state.available && state.guesses.length > 0 && (
        <ol className={styles.cards}>
          {state.guesses.map((g, index) => (
            <li
              key={g.tmdbId}
              className={`${styles.card} ${g.solved ? styles.cardSolved : ""} ${initialIds.has(g.tmdbId) ? "" : styles.fresh}`}
            >
              <div className={styles.cardHead}>
                {g.posterUrl && (
                  <Image src={g.posterUrl} alt="" width={30} height={45} style={{ height: "auto" }} />
                )}
                <span className={styles.cardTitle}>{g.title}</span>
                {/* Les propositions arrivent de la plus récente à la plus ancienne. */}
                <span className={styles.cardIndex}>#{state.guesses.length - index}</span>
              </div>
              <div className={styles.tiles}>
                {mobileOrder(g.cells).map((c, i) => (
                  <div
                    key={c.key}
                    className={`${styles.tile} ${tileSpan(c.key)} ${styles[c.state]}`}
                    style={{ ["--i" as string]: i }}
                  >
                    <span className={styles.tileLabel}>{c.label}</span>
                    <span className={styles.tileValue}>
                      {c.value}
                      <Arrow direction={c.direction} />
                    </span>
                  </div>
                ))}
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
