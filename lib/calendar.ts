import "server-only";
import { prisma } from "@/lib/db";
import { getFilmCards } from "@/lib/films";
import { fetchSeriesDetail } from "@/lib/tmdb";
import { fetchFilmRelease, parisToday, shiftDay } from "@/lib/releases";

/**
 * Calendrier personnel : sorties françaises des films attendus et épisodes
 * des séries suivies.
 *
 * - **Films attendus** : ceux pour lesquels on a demandé « me prévenir », et
 *   ceux de « À voir » qui ne sont pas encore sortis.
 * - **Séries suivies** : celles de « À voir » ou dont on a coché au moins un
 *   épisode, tant qu'elles ne sont pas terminées.
 *
 * Chaque titre coûte un appel TMDB (mis en cache) : les deux listes sont
 * bornées, les plus récemment touchées d'abord.
 */

export type CalendarEntry = {
  date: string;
  kind: "cinema" | "digital" | "episode";
  media: "movie" | "tv";
  tmdbId: number;
  title: string;
  posterUrl: string;
  /** « S02E05 · Titre de l'épisode ». */
  detail: string | null;
  /** Film avec « me prévenir » actif. */
  reminded: boolean;
  /** Date non française (repli sur la sortie mondiale). */
  foreignDate: boolean;
};

const MAX_FILMS = 80;
const MAX_SERIES = 60;
const RECENT_DAYS = 7;
const FILM_HORIZON_DAYS = 365;
const EPISODE_HORIZON_DAYS = 60;
const ENDED = new Set(["Ended", "Canceled"]);

export const episodeCode = (season: number, episode: number) =>
  `S${String(season).padStart(2, "0")}E${String(episode).padStart(2, "0")}`;

/**
 * « S02E05 · Titre ». Sans vrai titre, TMDB renvoie « Épisode 5 » : le
 * répéter après le code n'apprendrait rien.
 */
export function episodeLabel(season: number, episode: number, name: string): string {
  const code = episodeCode(season, episode);
  return name && !/^(Épisode|Episode) \d+$/.test(name) ? `${code} · ${name}` : code;
}

/** Séries suivies par un utilisateur, les plus récemment touchées d'abord. */
export async function followedSeriesIds(userId: string, limit = MAX_SERIES): Promise<number[]> {
  const [listed, episodes] = await Promise.all([
    prisma.userSeries.findMany({
      where: { userId, OR: [{ watchlist: true }, { watched: true }] },
      orderBy: { updatedAt: "desc" },
      select: { tmdbId: true },
    }),
    prisma.userEpisode.findMany({
      where: { userId },
      orderBy: { watchedAt: "desc" },
      distinct: ["seriesId"],
      select: { seriesId: true },
    }),
  ]);
  return [...new Set([...episodes.map((e) => e.seriesId), ...listed.map((s) => s.tmdbId)])].slice(0, limit);
}

async function filmEntries(userId: string, from: string, to: string): Promise<CalendarEntry[]> {
  const currentYear = new Date().getUTCFullYear();
  const [reminders, watchlist] = await Promise.all([
    prisma.releaseReminder.findMany({ where: { userId }, select: { tmdbId: true } }),
    prisma.userFilm.findMany({
      where: { userId, watchlist: true },
      orderBy: { updatedAt: "desc" },
      select: { tmdbId: true },
    }),
  ]);
  const reminded = new Set(reminders.map((r) => r.tmdbId));
  const cards = await getFilmCards([...reminded, ...watchlist.map((w) => w.tmdbId)]);

  // Un film de la liste sorti il y a deux ans n'a rien à faire au calendrier :
  // l'année du cache évite de demander ses dates à TMDB.
  const candidates = [
    ...reminded,
    ...watchlist
      .map((w) => w.tmdbId)
      .filter((id) => {
        const year = Number(cards.get(id)?.year);
        return !year || year >= currentYear - 1;
      }),
  ];
  const ids = [...new Set(candidates)].slice(0, MAX_FILMS);

  const releases = await Promise.all(ids.map(async (id) => [id, await fetchFilmRelease(id)] as const));
  return releases.flatMap(([id, release]) => {
    if (!release || release.date < from || release.date > to) return [];
    const card = cards.get(id);
    return [
      {
        date: release.date,
        kind: release.kind,
        media: "movie" as const,
        tmdbId: id,
        title: card?.title ?? "Film",
        posterUrl: card?.posterUrl ?? "",
        detail: null,
        reminded: reminded.has(id),
        foreignDate: !release.france,
      },
    ];
  });
}

async function episodeEntries(userId: string, from: string, today: string): Promise<CalendarEntry[]> {
  const to = shiftDay(today, EPISODE_HORIZON_DAYS);
  const ids = await followedSeriesIds(userId);
  const details = await Promise.all(ids.map((id) => fetchSeriesDetail(id).catch(() => null)));

  return details.flatMap((series) => {
    if (!series || ENDED.has(series.status)) return [];
    const entries: CalendarEntry[] = [];
    const base = {
      kind: "episode" as const,
      media: "tv" as const,
      tmdbId: series.id,
      title: series.name,
      posterUrl: series.posterUrl,
      reminded: false,
      foreignDate: false,
    };
    const next = series.nextEpisode;
    if (next?.airDate && next.airDate >= today && next.airDate <= to) {
      entries.push({
        ...base,
        date: next.airDate,
        detail: episodeLabel(next.seasonNumber, next.episodeNumber, next.name),
      });
    }
    const last = series.lastEpisode;
    if (last?.airDate && last.airDate >= from && last.airDate < today) {
      entries.push({
        ...base,
        date: last.airDate,
        detail: episodeLabel(last.seasonNumber, last.episodeNumber, last.name),
      });
    }
    return entries;
  });
}

export async function getCalendar(userId: string) {
  const today = parisToday();
  const from = shiftDay(today, -RECENT_DAYS);
  const [films, episodes] = await Promise.all([
    filmEntries(userId, from, shiftDay(today, FILM_HORIZON_DAYS)),
    episodeEntries(userId, from, today),
  ]);
  const all = [...films, ...episodes];
  return {
    today,
    upcoming: all.filter((e) => e.date >= today).sort((a, b) => a.date.localeCompare(b.date)),
    recent: all.filter((e) => e.date < today).sort((a, b) => b.date.localeCompare(a.date)),
  };
}
