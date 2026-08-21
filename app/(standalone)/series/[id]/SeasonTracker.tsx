"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronDown, Loader2 } from "lucide-react";
import type { TmdbSeasonSummary, TmdbEpisode } from "@/lib/tmdb";
import { toggleEpisode, setSeasonWatched, saveSeasonRating } from "@/app/actions/series";
import StarRating from "@/app/(app)/components/StarRating";
import { Rating } from "@/lib/rating-scale";
import styles from "./series.module.css";

type SeasonState = {
  episodes: TmdbEpisode[];
  watched: Set<number>;
  loaded: boolean;
};

/**
 * Un épisode est cochable seulement s'il est déjà diffusé. TMDB renvoie
 * `air_date` vide tant que la date n'est pas annoncée : dans ce cas on
 * considère l'épisode comme non sorti (date inconnue).
 */
function isReleased(ep: TmdbEpisode): boolean {
  if (!ep.airDate) return false;
  const air = new Date(`${ep.airDate}T00:00:00`);
  if (Number.isNaN(air.getTime())) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return air <= today;
}

const DATE_FMT = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", year: "numeric" });

function formatAirDate(airDate: string): string {
  const d = new Date(`${airDate}T00:00:00`);
  return Number.isNaN(d.getTime()) ? airDate : DATE_FMT.format(d);
}

export default function SeasonTracker({
  seriesId,
  seasons,
  watchedBySeason,
  ratingBySeason,
  isAuthenticated,
}: {
  seriesId: number;
  seasons: TmdbSeasonSummary[];
  watchedBySeason: Record<number, number>;
  /** Notes déjà attribuées, sur 10, par numéro de saison. */
  ratingBySeason: Record<number, number>;
  isAuthenticated: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState<number | null>(null);
  const [state, setState] = useState<Record<number, SeasonState>>({});
  const [counts, setCounts] = useState<Record<number, number>>(watchedBySeason);
  const [ratings, setRatings] = useState<Record<number, number>>(ratingBySeason);
  const [, startTransition] = useTransition();
  const [loadingSeason, setLoadingSeason] = useState<number | null>(null);

  async function expand(seasonNumber: number) {
    if (open === seasonNumber) {
      setOpen(null);
      return;
    }
    setOpen(seasonNumber);
    if (!state[seasonNumber]?.loaded) {
      setLoadingSeason(seasonNumber);
      const res = await fetch(`/api/series/${seriesId}/season/${seasonNumber}`);
      const data = res.ok ? await res.json() : { episodes: [], watched: [], rating: null };
      setState((prev) => ({
        ...prev,
        [seasonNumber]: {
          episodes: data.episodes,
          watched: new Set<number>(data.watched),
          loaded: true,
        },
      }));
      // Resynchronise la note au cas où elle aurait changé ailleurs.
      setRatings((r) => ({ ...r, [seasonNumber]: data.rating ?? 0 }));
      setLoadingSeason(null);
    }
  }

  function requireAuth(): boolean {
    if (!isAuthenticated) {
      router.push("/login");
      return false;
    }
    return true;
  }

  function onToggleEpisode(seasonNumber: number, ep: TmdbEpisode) {
    if (!requireAuth()) return;
    // Garde-fou : le bouton est déjà `disabled`, mais on ne veut en aucun cas
    // enregistrer un épisode non diffusé (il compterait dans l'XP / le temps vu).
    if (!isReleased(ep)) return;
    const s = state[seasonNumber];
    if (!s) return;
    const was = s.watched.has(ep.episodeNumber);

    // maj optimiste
    setState((prev) => {
      const next = new Set(prev[seasonNumber].watched);
      if (was) next.delete(ep.episodeNumber);
      else next.add(ep.episodeNumber);
      return { ...prev, [seasonNumber]: { ...prev[seasonNumber], watched: next } };
    });
    setCounts((c) => ({ ...c, [seasonNumber]: (c[seasonNumber] ?? 0) + (was ? -1 : 1) }));

    startTransition(async () => {
      try {
        await toggleEpisode(seriesId, seasonNumber, ep.episodeNumber, ep.runtime);
      } catch {
        router.refresh();
      }
    });
  }

  function onToggleSeason(seasonNumber: number, watched: boolean) {
    if (!requireAuth()) return;
    const s = state[seasonNumber];
    if (!s) return;

    // « Marquer la saison comme vue » ne concerne que les épisodes diffusés :
    // sur une saison en cours, les épisodes à venir restent décochés.
    const released = s.episodes.filter(isReleased);

    setState((prev) => ({
      ...prev,
      [seasonNumber]: {
        ...prev[seasonNumber],
        watched: watched
          ? new Set(released.map((e) => e.episodeNumber))
          : new Set(),
      },
    }));
    setCounts((c) => ({ ...c, [seasonNumber]: watched ? released.length : 0 }));

    startTransition(async () => {
      try {
        await setSeasonWatched(
          seriesId,
          seasonNumber,
          released.map((e) => ({ episodeNumber: e.episodeNumber, runtime: e.runtime })),
          watched,
        );
      } catch {
        router.refresh();
      }
    });
  }

  function onRateSeason(seasonNumber: number, rating: number | null) {
    if (!requireAuth()) return;
    setRatings((r) => ({ ...r, [seasonNumber]: rating ?? 0 }));
    startTransition(async () => {
      try {
        await saveSeasonRating(seriesId, seasonNumber, rating);
      } catch {
        router.refresh();
      }
    });
  }

  return (
    <div className={styles.seasons}>
      {seasons.map((season) => {
        const watched = counts[season.seasonNumber] ?? 0;
        const pct = season.episodeCount > 0 ? Math.round((watched / season.episodeCount) * 100) : 0;
        const isOpen = open === season.seasonNumber;
        const s = state[season.seasonNumber];
        // Une saison en cours ne peut pas être « complète » au sens TMDB :
        // une fois les épisodes chargés, on se base sur ceux déjà diffusés.
        const releasedCount = s?.loaded ? s.episodes.filter(isReleased).length : season.episodeCount;
        const allWatched = releasedCount > 0 && watched >= releasedCount;

        return (
          <div key={season.seasonNumber} className={styles.season}>
            <button className={styles.seasonHead} onClick={() => expand(season.seasonNumber)}>
              <ChevronDown
                size={16}
                className={`${styles.chevron} ${isOpen ? styles.chevronOpen : ""}`}
              />
              <span className={styles.seasonName}>{season.name}</span>
              {/* Moyenne TMDB de la saison. Elle vient de la liste des saisons
                  de /tv/{id}, donc elle est connue sans déplier ni requête. */}
              {season.voteAverage > 0 && (
                <span className={styles.seasonAvg}>
                  Moyenne saison · ★ <Rating value={season.voteAverage} />
                </span>
              )}
              {(ratings[season.seasonNumber] ?? 0) > 0 && (
                <span className={styles.seasonScore}>
                  ★ <Rating value={ratings[season.seasonNumber]} />
                </span>
              )}
              <span className={styles.seasonProgress}>
                {watched}/{season.episodeCount}
              </span>
              <span className={styles.seasonBar}>
                <span className={styles.seasonBarFill} style={{ width: `${pct}%` }} />
              </span>
            </button>

            {isOpen && (
              <div className={styles.episodes}>
                {loadingSeason === season.seasonNumber && !s?.loaded ? (
                  <div className={styles.episodeLoading}>
                    <Loader2 size={16} className={styles.spin} /> Chargement des épisodes…
                  </div>
                ) : (
                  <>
                    <div className={styles.seasonToolbar}>
                      <button
                        className={styles.markSeason}
                        onClick={() => onToggleSeason(season.seasonNumber, !allWatched)}
                      >
                        {allWatched ? "Tout démarquer" : "Marquer la saison comme vue"}
                      </button>
                      {/* Note propre à la saison, indépendante de celle de la
                          série. Recliquer la même valeur la retire. */}
                      <div className={styles.seasonRating}>
                        <span className={styles.seasonRatingLabel}>Ma note</span>
                        <StarRating
                          value={ratings[season.seasonNumber] ?? 0}
                          size={16}
                          label={season.name}
                          onRate={(v) => onRateSeason(season.seasonNumber, v)}
                          onClear={() => onRateSeason(season.seasonNumber, null)}
                        />
                      </div>
                    </div>
                    {s?.episodes.map((ep) => {
                      const isWatched = s.watched.has(ep.episodeNumber);
                      const released = isReleased(ep);
                      return (
                        <button
                          key={ep.episodeNumber}
                          className={`${styles.episode} ${isWatched ? styles.episodeOn : ""} ${released ? "" : styles.episodeLocked}`}
                          onClick={() => onToggleEpisode(season.seasonNumber, ep)}
                          disabled={!released}
                          title={released ? undefined : "Épisode pas encore diffusé"}
                        >
                          <span className={`${styles.check} ${isWatched ? styles.checkOn : ""}`}>
                            {isWatched && <Check size={12} strokeWidth={3} />}
                          </span>
                          <span className={styles.epNum}>{ep.episodeNumber}</span>
                          <span className={styles.epName}>
                            {ep.name || `Épisode ${ep.episodeNumber}`}
                            {ep.directors.length > 0 && (
                              <span className={styles.epDirector}>
                                {" "}· {ep.directors.map((d) => d.name).join(", ")}
                              </span>
                            )}
                          </span>
                          {/* Finale de saison ou de mi-saison : l'info se perd
                              autrement dans une liste de 24 lignes. */}
                          {(ep.episodeType === "finale" || ep.episodeType === "mid_season") && (
                            <span className={styles.epFinale}>
                              {ep.episodeType === "finale" ? "Finale" : "Mi-saison"}
                            </span>
                          )}
                          {/* Note TMDB de l'épisode, quand elle est un tant soit
                              peu soutenue (sinon elle induit en erreur). */}
                          {released && ep.voteAverage > 0 && ep.voteCount >= 10 && (
                            <span className={styles.epScore}>★ <Rating value={ep.voteAverage} /></span>
                          )}
                          {/* Épisode à venir : date complète (l'info utile),
                              sinon la simple année suffit. */}
                          {released ? (
                            ep.airDate && <span className={styles.epDate}>{ep.airDate.slice(0, 4)}</span>
                          ) : (
                            <span className={`${styles.epDate} ${styles.epUpcoming}`}>
                              {ep.airDate ? formatAirDate(ep.airDate) : "Date inconnue"}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
