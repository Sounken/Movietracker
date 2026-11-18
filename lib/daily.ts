import "server-only";
import { prisma } from "@/lib/db";
import { getFilmCards } from "@/lib/films";
import { fetchSeriesDetail, fetchWatchProviders } from "@/lib/tmdb";
import { WATCH_PROVIDERS, canonicalProvider } from "@/lib/tmdb-catalog";
import { fetchFilmRelease, parisToday, shiftDay } from "@/lib/releases";
import { episodeLabel } from "@/lib/calendar";
import { sendSystemNotifications, type SystemNotification } from "@/lib/notify";

/**
 * Tâches du passage quotidien (cf. /api/cron/daily). Chacune est rejouable :
 * les notifications portent une clé d'unicité, un second passage le même jour
 * n'envoie rien de plus.
 */

/**
 * Au-delà, une sortie « ratée » (tâche arrêtée plusieurs jours, date avancée
 * par le distributeur) est soldée sans notification : annoncer « sort
 * aujourd'hui » une semaine après serait faux.
 */
const LATE_TOLERANCE_DAYS = 2;

/** « Me prévenir » : les films sortis en France aujourd'hui. */
export async function runReleaseReminders(today = parisToday()) {
  const pending = await prisma.releaseReminder.findMany({
    where: { notifiedAt: null },
    select: { id: true, userId: true, tmdbId: true },
  });
  const filmIds = [...new Set(pending.map((r) => r.tmdbId))];
  const releases = new Map(
    await Promise.all(filmIds.map(async (id) => [id, await fetchFilmRelease(id)] as const)),
  );
  const due = pending.filter((r) => {
    const release = releases.get(r.tmdbId);
    return release && release.date <= today;
  });
  if (due.length === 0) return { reminders: pending.length, sent: 0 };

  const cards = await getFilmCards([...new Set(due.map((r) => r.tmdbId))]);
  const oldest = shiftDay(today, -LATE_TOLERANCE_DAYS);
  const rows: SystemNotification[] = due
    .filter((r) => releases.get(r.tmdbId)!.date >= oldest)
    .map((r) => {
      const release = releases.get(r.tmdbId)!;
      return {
        userId: r.userId,
        type: "release",
        media: "movie",
        tmdbId: r.tmdbId,
        title: cards.get(r.tmdbId)?.title ?? "Un film attendu",
        detail: release.kind === "digital" ? "en numérique" : "au cinéma",
        dedupeKey: `release:movie:${r.tmdbId}:${r.userId}`,
      };
    });

  const sent = await sendSystemNotifications(rows);
  await prisma.releaseReminder.updateMany({
    where: { id: { in: due.map((r) => r.id) } },
    data: { notifiedAt: new Date() },
  });
  return { reminders: pending.length, sent: sent.length, sentRows: sent };
}

/**
 * Nouveaux épisodes : prévient ceux qui ont commencé la série (au moins un
 * épisode coché) quand un épisode sort aujourd'hui ou est sorti hier — le
 * passage peut avoir lieu avant la mise à jour de TMDB.
 */
export async function runEpisodeAlerts(today = parisToday()) {
  const followers = await prisma.userEpisode.findMany({
    distinct: ["userId", "seriesId"],
    select: { userId: true, seriesId: true },
  });
  const bySeries = new Map<number, string[]>();
  for (const f of followers) bySeries.set(f.seriesId, [...(bySeries.get(f.seriesId) ?? []), f.userId]);

  const yesterday = shiftDay(today, -1);
  const rows: SystemNotification[] = [];
  for (const [seriesId, userIds] of bySeries) {
    const series = await fetchSeriesDetail(seriesId).catch(() => null);
    const last = series?.lastEpisode;
    if (!series || !last?.airDate || last.airDate < yesterday || last.airDate > today) continue;
    const label = episodeLabel(last.seasonNumber, last.episodeNumber, last.name);
    for (const userId of userIds) {
      rows.push({
        userId,
        type: "episode",
        media: "tv",
        tmdbId: seriesId,
        title: series.name,
        detail: label,
        dedupeKey: `episode:${seriesId}:${last.seasonNumber}:${last.episodeNumber}:${userId}`,
      });
    }
  }
  const sent = await sendSystemNotifications(rows);
  return { series: bySeries.size, sent: sent.length, sentRows: sent };
}

const PROVIDER_NAME = new Map(WATCH_PROVIDERS.map((p) => [p.id, p.name]));

/** « sur Netflix », « sur Netflix et Prime Video ». */
function onProviders(ids: number[]): string {
  const names = ids.map((id) => PROVIDER_NAME.get(id) ?? "une plateforme");
  return `sur ${names.length > 1 ? `${names.slice(0, -1).join(", ")} et ${names.at(-1)}` : names[0]}`;
}

/**
 * Disponibilité : un film de « À voir » arrive en abonnement sur une des
 * plateformes de l'utilisateur.
 *
 * Seules comptent les **arrivées** depuis le passage précédent
 * (FilmProviderSnapshot). Un film vu pour la première fois est seulement
 * photographié : ce qui était déjà disponible ne déclenche rien.
 */
export async function runAvailabilityAlerts() {
  const watchers = await prisma.userFilm.findMany({
    where: { watchlist: true, user: { watchProviders: { isEmpty: false } } },
    select: { userId: true, tmdbId: true, user: { select: { watchProviders: true } } },
  });
  const filmIds = [...new Set(watchers.map((w) => w.tmdbId))];
  const snapshots = new Map(
    (await prisma.filmProviderSnapshot.findMany({ where: { tmdbId: { in: filmIds } } })).map((s) => [
      s.tmdbId,
      s.providers,
    ]),
  );

  const arrivals = new Map<number, number[]>();
  for (const tmdbId of filmIds) {
    const { flatrate } = await fetchWatchProviders("movie", tmdbId);
    const current = [...new Set(flatrate.map((p) => canonicalProvider(p.id)))].filter((id) =>
      PROVIDER_NAME.has(id),
    );
    const previous = snapshots.get(tmdbId);
    if (previous) {
      const added = current.filter((id) => !previous.includes(id));
      if (added.length > 0) arrivals.set(tmdbId, added);
    }
    await prisma.filmProviderSnapshot.upsert({
      where: { tmdbId },
      create: { tmdbId, providers: current },
      update: { providers: current },
    });
  }
  if (arrivals.size === 0) return { films: filmIds.length, sent: 0 };

  const cards = await getFilmCards([...arrivals.keys()]);
  const rows: SystemNotification[] = watchers.flatMap((w) => {
    const mine = (arrivals.get(w.tmdbId) ?? []).filter((id) => w.user.watchProviders.includes(id)).sort();
    if (mine.length === 0) return [];
    return [
      {
        userId: w.userId,
        type: "available" as const,
        media: "movie" as const,
        tmdbId: w.tmdbId,
        title: cards.get(w.tmdbId)?.title ?? "Un film de votre liste",
        detail: onProviders(mine),
        dedupeKey: `available:movie:${w.tmdbId}:${mine.join("-")}:${w.userId}`,
      },
    ];
  });
  const sent = await sendSystemNotifications(rows);
  return { films: filmIds.length, sent: sent.length, sentRows: sent };
}
