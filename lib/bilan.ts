import "server-only";
import { prisma } from "@/lib/db";
import { getFilmCards } from "@/lib/films";
import { getSeriesCards } from "@/lib/series";

/**
 * Bilan d'une année : ce qui a été vu, combien de temps, ce qu'on a préféré.
 *
 * **Ce qui compte comme « vu dans l'année »** : les visionnages du journal
 * datés de l'année, plus les films marqués vus sans date et ajoutés à la
 * collection cette année-là (noter un film depuis sa fiche ne le date pas).
 * Un film déjà au journal n'est jamais compté par sa date d'ajout : seul le
 * journal fait foi pour lui.
 */

export type BilanFilm = { tmdbId: number; title: string; posterUrl: string; rating: number | null };

export type Bilan = {
  year: number;
  films: {
    /** Films distincts vus dans l'année. */
    count: number;
    /** Visionnages du journal qui n'étaient pas le premier du film. */
    rewatches: number;
    minutes: number;
    /** Note moyenne (sur 10) des films de l'année qui en ont une. */
    avgRating: number | null;
  };
  /** Les mieux notés de l'année, cinq au plus. */
  topFilms: BilanFilm[];
  genres: { name: string; count: number }[];
  /** Visionnages par mois, de janvier à décembre. */
  months: number[];
  firstFilm: (BilanFilm & { date: Date }) | null;
  lastFilm: (BilanFilm & { date: Date }) | null;
  /** Décennie la plus représentée (« 1990 »), si elle se détache. */
  decade: string | null;
  series: {
    episodes: number;
    minutes: number;
    top: { tmdbId: number; name: string; posterUrl: string; episodes: number }[];
  };
};

/** Aucun bilan avant : le journal ne remonte pas plus loin utilement. */
const BILAN_FIRST_YEAR = 1990;

/**
 * Années proposables, de l'année en cours à la première année d'activité de
 * l'utilisateur (journal, ajout d'un film vu, épisode coché).
 */
export async function bilanYears(userId: string): Promise<number[]> {
  const [watch, film, episode] = await Promise.all([
    prisma.filmWatch.aggregate({ where: { userId }, _min: { watchedAt: true } }),
    prisma.userFilm.aggregate({ where: { userId, watched: true }, _min: { createdAt: true } }),
    prisma.userEpisode.aggregate({ where: { userId }, _min: { watchedAt: true } }),
  ]);
  const current = new Date().getUTCFullYear();
  const earliest = Math.min(
    current,
    ...[watch._min.watchedAt, film._min.createdAt, episode._min.watchedAt]
      .filter((d): d is Date => d !== null)
      .map((d) => d.getUTCFullYear()),
  );
  const years: number[] = [];
  for (let y = current; y >= Math.max(earliest, BILAN_FIRST_YEAR); y--) years.push(y);
  return years;
}

function topCounts<T>(items: T[], limit: number): { value: T; count: number }[] {
  const counts = new Map<T, number>();
  for (const item of items) counts.set(item, (counts.get(item) ?? 0) + 1);
  return [...counts.entries()]
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

export async function computeBilan(userId: string, year: number): Promise<Bilan> {
  const start = new Date(Date.UTC(year, 0, 1));
  const end = new Date(Date.UTC(year + 1, 0, 1));
  const inYear = { gte: start, lt: end };

  const [watches, firstWatches, undatedCandidates, episodes] = await Promise.all([
    prisma.filmWatch.findMany({
      where: { userId, watchedAt: inYear },
      orderBy: [{ watchedAt: "asc" }, { createdAt: "asc" }, { id: "asc" }],
      select: { id: true, tmdbId: true, watchedAt: true },
    }),
    // Premier visionnage de chaque film, toutes années confondues : il dit si
    // un visionnage de l'année est un revisionnage, et quels films ont un journal.
    prisma.filmWatch.findMany({
      where: { userId },
      orderBy: [{ watchedAt: "asc" }, { createdAt: "asc" }, { id: "asc" }],
      distinct: ["tmdbId"],
      select: { id: true, tmdbId: true },
    }),
    prisma.userFilm.findMany({
      where: { userId, watched: true, createdAt: inYear },
      select: { tmdbId: true, createdAt: true },
    }),
    prisma.userEpisode.findMany({
      where: { userId, watchedAt: inYear },
      select: { seriesId: true, runtime: true },
    }),
  ]);

  const firstIds = new Set(firstWatches.map((w) => w.id));
  const hasJournal = new Set(firstWatches.map((w) => w.tmdbId));
  const undated = undatedCandidates.filter((f) => !hasJournal.has(f.tmdbId));

  // Un visionnage = un passage devant le film ; les revisionnages comptent
  // dans le temps passé et dans les mois, pas dans le nombre de films.
  const views = [
    ...watches.map((w) => ({ tmdbId: w.tmdbId, date: w.watchedAt })),
    ...undated.map((f) => ({ tmdbId: f.tmdbId, date: f.createdAt })),
  ];
  const tmdbIds = [...new Set(views.map((v) => v.tmdbId))];

  const [userFilms, cards, cachedRuntimes] = await Promise.all([
    prisma.userFilm.findMany({
      where: { userId, tmdbId: { in: tmdbIds } },
      select: { tmdbId: true, rating: true, runtime: true },
    }),
    getFilmCards(tmdbIds),
    prisma.film.findMany({
      where: { tmdbId: { in: tmdbIds }, runtime: { not: null } },
      select: { tmdbId: true, runtime: true },
    }),
  ]);
  const ratingOf = new Map(userFilms.map((f) => [f.tmdbId, f.rating]));
  const runtimeOf = new Map(cachedRuntimes.map((f) => [f.tmdbId, f.runtime ?? 0]));
  for (const f of userFilms) if (f.runtime) runtimeOf.set(f.tmdbId, f.runtime);

  const toFilm = (tmdbId: number): BilanFilm => {
    const card = cards.get(tmdbId);
    return {
      tmdbId,
      title: card?.title ?? "Film inconnu",
      posterUrl: card?.posterUrl ?? "",
      rating: ratingOf.get(tmdbId) ?? null,
    };
  };

  const ratings = tmdbIds.map((id) => ratingOf.get(id)).filter((r): r is number => r != null);

  const months = Array.from({ length: 12 }, () => 0);
  for (const v of views) months[v.date.getUTCMonth()]++;

  const topFilms = tmdbIds
    .filter((id) => ratingOf.get(id) != null)
    .map(toFilm)
    .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))
    .slice(0, 5);

  const genres = topCounts(
    tmdbIds.flatMap((id) => cards.get(id)?.genres ?? []),
    5,
  ).map(({ value, count }) => ({ name: value, count }));

  // Une décennie ne « se détache » qu'à partir de trois films et d'un quart
  // de l'année : sur quatre films, en citer une ne dirait rien.
  const decades = topCounts(
    tmdbIds
      .map((id) => cards.get(id)?.year)
      .filter((y): y is string => Boolean(y))
      .map((y) => `${y.slice(0, 3)}0`),
    1,
  );
  const decade =
    decades[0] && decades[0].count >= 3 && decades[0].count >= tmdbIds.length / 4
      ? decades[0].value
      : null;

  const first = watches[0];
  const last = watches.at(-1);

  // Séries : épisodes cochés dans l'année.
  const episodesBySeries = topCounts(episodes.map((e) => e.seriesId), 3);
  const seriesCards = await getSeriesCards(episodesBySeries.map((s) => s.value));

  return {
    year,
    films: {
      count: tmdbIds.length,
      rewatches: watches.filter((w) => !firstIds.has(w.id)).length,
      minutes: views.reduce((sum, v) => sum + (runtimeOf.get(v.tmdbId) ?? 0), 0),
      avgRating: ratings.length > 0 ? ratings.reduce((a, b) => a + b, 0) / ratings.length : null,
    },
    topFilms,
    genres,
    months,
    firstFilm: first ? { ...toFilm(first.tmdbId), date: first.watchedAt } : null,
    lastFilm: last && last.id !== first?.id ? { ...toFilm(last.tmdbId), date: last.watchedAt } : null,
    decade,
    series: {
      episodes: episodes.length,
      minutes: episodes.reduce((sum, e) => sum + (e.runtime ?? 0), 0),
      top: episodesBySeries.map(({ value, count }) => ({
        tmdbId: value,
        name: seriesCards.get(value)?.name ?? "Série inconnue",
        posterUrl: seriesCards.get(value)?.posterUrl ?? "",
        episodes: count,
      })),
    },
  };
}

/** « 132 h » ou « 45 min ». */
export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  return `${Math.round(minutes / 60).toLocaleString("fr-FR")} h`;
}
