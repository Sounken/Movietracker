"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronDown, Loader2 } from "lucide-react";
import type { TmdbSeasonSummary, TmdbEpisode } from "@/lib/tmdb";
import { toggleEpisode, setSeasonWatched } from "@/app/actions/series";
import styles from "./series.module.css";

type SeasonState = {
  episodes: TmdbEpisode[];
  watched: Set<number>;
  loaded: boolean;
};

export default function SeasonTracker({
  seriesId,
  seasons,
  watchedBySeason,
  isAuthenticated,
}: {
  seriesId: number;
  seasons: TmdbSeasonSummary[];
  watchedBySeason: Record<number, number>;
  isAuthenticated: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState<number | null>(null);
  const [state, setState] = useState<Record<number, SeasonState>>({});
  const [counts, setCounts] = useState<Record<number, number>>(watchedBySeason);
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
      const data = res.ok ? await res.json() : { episodes: [], watched: [] };
      setState((prev) => ({
        ...prev,
        [seasonNumber]: {
          episodes: data.episodes,
          watched: new Set<number>(data.watched),
          loaded: true,
        },
      }));
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

    setState((prev) => ({
      ...prev,
      [seasonNumber]: {
        ...prev[seasonNumber],
        watched: watched
          ? new Set(s.episodes.map((e) => e.episodeNumber))
          : new Set(),
      },
    }));
    setCounts((c) => ({ ...c, [seasonNumber]: watched ? s.episodes.length : 0 }));

    startTransition(async () => {
      try {
        await setSeasonWatched(
          seriesId,
          seasonNumber,
          s.episodes.map((e) => ({ episodeNumber: e.episodeNumber, runtime: e.runtime })),
          watched,
        );
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
        const allWatched = watched >= season.episodeCount && season.episodeCount > 0;

        return (
          <div key={season.seasonNumber} className={styles.season}>
            <button className={styles.seasonHead} onClick={() => expand(season.seasonNumber)}>
              <ChevronDown
                size={16}
                className={`${styles.chevron} ${isOpen ? styles.chevronOpen : ""}`}
              />
              <span className={styles.seasonName}>{season.name}</span>
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
                    <button
                      className={styles.markSeason}
                      onClick={() => onToggleSeason(season.seasonNumber, !allWatched)}
                    >
                      {allWatched ? "Tout démarquer" : "Marquer la saison comme vue"}
                    </button>
                    {s?.episodes.map((ep) => {
                      const isWatched = s.watched.has(ep.episodeNumber);
                      return (
                        <button
                          key={ep.episodeNumber}
                          className={`${styles.episode} ${isWatched ? styles.episodeOn : ""}`}
                          onClick={() => onToggleEpisode(season.seasonNumber, ep)}
                        >
                          <span className={`${styles.check} ${isWatched ? styles.checkOn : ""}`}>
                            {isWatched && <Check size={12} strokeWidth={3} />}
                          </span>
                          <span className={styles.epNum}>{ep.episodeNumber}</span>
                          <span className={styles.epName}>{ep.name || `Épisode ${ep.episodeNumber}`}</span>
                          {ep.airDate && <span className={styles.epDate}>{ep.airDate.slice(0, 4)}</span>}
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
