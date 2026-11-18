import "server-only";
import { prisma } from "@/lib/db";

/** Notification envoyée par l'application (sortie, épisode, disponibilité). */
export type SystemNotification = {
  userId: string;
  type: "release" | "episode" | "available";
  media: "movie" | "tv";
  tmdbId: number;
  title: string;
  detail?: string;
  /** Identité de l'événement pour ce destinataire : rejouer ne renvoie rien. */
  dedupeKey: string;
};

/**
 * Crée les notifications qui n'existent pas encore et renvoie celles qui
 * viennent d'être créées (les autres avaient déjà été envoyées).
 */
export async function sendSystemNotifications(
  rows: SystemNotification[],
): Promise<SystemNotification[]> {
  if (rows.length === 0) return [];
  const already = await prisma.notification.findMany({
    where: { dedupeKey: { in: rows.map((r) => r.dedupeKey) } },
    select: { dedupeKey: true },
  });
  const known = new Set(already.map((n) => n.dedupeKey));
  const fresh = rows.filter((r) => !known.has(r.dedupeKey));
  if (fresh.length === 0) return [];

  await prisma.notification.createMany({
    data: fresh.map((r) => ({
      userId: r.userId,
      type: r.type,
      media: r.media,
      tmdbId: r.tmdbId,
      title: r.title,
      detail: r.detail ?? null,
      dedupeKey: r.dedupeKey,
    })),
    // Filet si deux passages se chevauchent : la contrainte d'unicité tranche.
    skipDuplicates: true,
  });
  return fresh;
}
