"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Image from "next/image";
import { ArrowUp, ArrowDown, Check, Search as SearchGlyph } from "lucide-react";
import { submitGuess, type PuzzleState } from "@/app/actions/puzzle";
import type { PuzzleMedia } from "@/lib/puzzle";
import styles from "./PuzzleBoard.module.css";

type Suggestion = { tmdbId: number; title: string; year: number; posterUrl: string };

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
}: {
  media: PuzzleMedia;
  initial: PuzzleState;
  streak: number;
}) {
  const [state, setState] = useState<PuzzleState>(initial);
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const wrapRef = useRef<HTMLDivElement | null>(null);

  const played = new Set(state.guesses.map((g) => g.tmdbId));

  // Autocomplétion : une requête par pause de frappe, comme la recherche de
  // la collection.
  useEffect(() => {
    // Pas de `setSuggestions([])` ici : vider l'état depuis un effet déclenche
    // un rendu en cascade (et le lint du projet le refuse). Sous deux
    // caractères, on n'interroge rien et l'affichage est filtré plus bas.
    if (query.trim().length < 2) return;
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
  // La liste n'est montrée qu'à partir de deux caractères : en dessous, les
  // résultats affichés seraient ceux de la frappe précédente.
  const visible = query.trim().length >= 2 ? suggestions : [];

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
            placeholder={`Proposer un ${noun}…`}
            disabled={pending}
            aria-label={`Proposer un ${noun}`}
          />
          {visible.length > 0 && (
            <div className={styles.suggestions}>
              {visible.map((s) => {
                const already = played.has(s.tmdbId);
                return (
                  <button
                    key={s.tmdbId}
                    type="button"
                    className={styles.suggestion}
                    onClick={() => !already && play(s.tmdbId)}
                    disabled={already}
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
                  </button>
                );
              })}
            </div>
            )}
          </div>
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
          en dessous. Aucune limite d&apos;essais.
        </div>
      ) : (
        <div className={styles.gridScroll}>
          <div className={styles.grid}>
            <div className={styles.rowHead}>
              <div className={styles.cellHead}>{media === "movie" ? "Film" : "Série"}</div>
              {state.guesses[0].cells.map((c) => (
                <div key={c.key} className={styles.cellHead}>
                  {c.label}
                </div>
              ))}
            </div>
            {state.guesses.map((g) => (
              <div key={g.tmdbId} className={styles.row}>
                <div className={styles.cellTitle}>
                  {g.posterUrl && (
                    <Image src={g.posterUrl} alt="" width={28} height={42} style={{ height: "auto" }} />
                  )}
                  <span>{g.title}</span>
                </div>
                {g.cells.map((c) => (
                  <div key={c.key} className={`${styles.cell} ${styles[c.state]}`}>
                    <span>{c.value}</span>
                    {c.direction === "higher" && <ArrowUp size={13} />}
                    {c.direction === "lower" && <ArrowDown size={13} />}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
