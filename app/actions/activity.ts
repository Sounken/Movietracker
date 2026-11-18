"use server";

import { after } from "next/server";
import { getSession } from "@/lib/session";
import { getFilmCard } from "@/lib/films";
import { getSeriesCard } from "@/lib/series";
import { sendPushes } from "@/lib/push";
import { prisma } from "@/lib/db";
import {
  canSeeActivity,
  getFeed,
  isReactionEmoji,
  summarizeReactions,
  type ActivityMedia,
  type ReactionSummary,
} from "@/lib/activity";

/**
 * Ajoute ou retire une réaction, et renvoie les réactions à jour.
 *
 * Réagir notifie l'auteur — une seule notification par personne qui réagit,
 * remise en tête à chaque nouvelle réaction plutôt qu'empilée.
 */
export async function toggleReaction(activityId: string, emoji: string): Promise<ReactionSummary[]> {
  const session = await getSession();
  if (!session) throw new Error("Non authentifié");
  if (!isReactionEmoji(emoji)) throw new Error("Réaction inconnue");
  const userId = session.userId;

  const activity = await prisma.activity.findUnique({
    where: { id: activityId },
    select: { userId: true, media: true, tmdbId: true },
  });
  if (!activity || !(await canSeeActivity(userId, activity.userId))) {
    throw new Error("Activité introuvable");
  }

  const key = { activityId_userId_emoji: { activityId, userId, emoji } };
  const existing = await prisma.activityReaction.findUnique({ where: key, select: { id: true } });

  if (existing) {
    // Retirer sa réaction ne retire pas la notification : l'auteur l'a
    // peut-être déjà vue, la faire disparaître passerait pour un bug.
    await prisma.activityReaction.delete({ where: { id: existing.id } });
  } else {
    await prisma.activityReaction.create({ data: { activityId, userId, emoji } });
    if (activity.userId !== userId) {
      await prisma.notification.upsert({
        where: { userId_actorId_type: { userId: activity.userId, actorId: userId, type: "reaction" } },
        create: { userId: activity.userId, actorId: userId, type: "reaction", activityId, emoji },
        update: { activityId, emoji, readAt: null, createdAt: new Date() },
      });
      const actor = session.name ?? "Quelqu'un";
      after(async () => {
        const title =
          activity.media === "tv"
            ? (await getSeriesCard(activity.tmdbId))?.name
            : (await getFilmCard(activity.tmdbId))?.title;
        const feed = activity.media === "tv" ? "/series/friends" : "/friends";
        await sendPushes([
          {
            userId: activity.userId,
            category: "social",
            payload: {
              title: `${actor} a réagi ${emoji}`,
              body: title ? `À votre activité sur ${title}.` : "À votre activité.",
              url: `${feed}#activite-${activityId}`,
              tag: `reaction:${activityId}`,
            },
          },
        ]);
      });
    }
  }

  const reactions = await prisma.activityReaction.findMany({
    where: { activityId },
    select: { emoji: true, userId: true },
  });
  return summarizeReactions(reactions, userId);
}

/** Page suivante du fil (« Voir plus »). */
export async function loadMoreActivity(media: ActivityMedia, before: string) {
  const session = await getSession();
  if (!session) throw new Error("Non authentifié");
  return getFeed(session.userId, media === "tv" ? "tv" : "movie", before);
}
