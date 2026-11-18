import "server-only";
import { prisma } from "@/lib/db";
import { getFilmCards } from "@/lib/films";
import { fetchSeriesDetail } from "@/lib/tmdb";
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
