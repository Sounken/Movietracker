import "server-only";
import { prisma } from "@/lib/db";

/** Longueur maximale d'une remarque de journal. */
export const WATCH_NOTE_MAX_LENGTH = 300;

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Date de visionnage saisie (« 2026-11-18 »), à minuit UTC, ou `null` si elle
 * est mal formée, antérieure à 1900 ou dans le futur.
 *
 * Le futur est toléré d'un jour : la date du formulaire est celle du
 * navigateur, qui peut avoir un jour d'avance sur le serveur en UTC.
 */
export function parseWatchDate(raw: string | null | undefined): Date | null {
  if (!raw || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
  const date = new Date(`${raw}T00:00:00Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== raw) return null;
  if (date.getUTCFullYear() < 1900 || date.getTime() > Date.now() + DAY_MS) return null;
  return date;
}

/** Aligne `UserFilm.watchedAt` sur le visionnage le plus récent du journal. */
export async function syncLatestWatch(userId: string, tmdbId: number) {
  const latest = await prisma.filmWatch.findFirst({
    where: { userId, tmdbId },
    orderBy: { watchedAt: "desc" },
    select: { watchedAt: true },
  });
  await prisma.userFilm.updateMany({
    where: { userId, tmdbId },
    data: { watchedAt: latest?.watchedAt ?? null },
  });
}

/**
 * Ajoute au journal les dates qui n'y sont pas déjà pour ce film.
 *
 * Utilisé par l'ajout manuel et l'import : rejouer un import ou réenregistrer
 * la même date ne crée pas de doublon. Le journal d'un revisionnage saisi
 * depuis la fiche passe par `logFilmWatch`, qui accepte deux visionnages le
 * même jour.
 */
export async function addMissingWatches(
  userId: string,
  tmdbId: number,
  dates: Date[],
): Promise<{ id: string; watchedAt: Date }[]> {
  if (dates.length === 0) return [];
  const existing = await prisma.filmWatch.findMany({
    where: { userId, tmdbId },
    select: { watchedAt: true },
  });
  const known = new Set(existing.map((w) => w.watchedAt.getTime()));
  const missing = [...new Set(dates.map((d) => d.getTime()))].filter((t) => !known.has(t));
  const created =
    missing.length > 0
      ? await prisma.filmWatch.createManyAndReturn({
          data: missing.map((t) => ({ userId, tmdbId, watchedAt: new Date(t) })),
          select: { id: true, watchedAt: true },
        })
      : [];
  await syncLatestWatch(userId, tmdbId);
  return created;
}
