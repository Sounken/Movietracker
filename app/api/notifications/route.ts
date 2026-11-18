import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";
import { getFilmCards } from "@/lib/films";
import { getSeriesCards } from "@/lib/series";

/**
 * Notifications de l'utilisateur connecté.
 *
 * La session est vérifiée avant toute requête : `getSession` ne fait que
 * déchiffrer un cookie, donc un visiteur anonyme — un robot, par exemple — ne
 * déclenche aucune lecture en base. C'est la même précaution que sur la route
 * de collecte des web vitals, pour la même raison : la base Neon se facture au
 * temps éveillé.
 */

/** Au-delà, personne ne fait défiler une liste de notifications. */
const MAX_ITEMS = 20;

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ items: [], unread: 0 });

  const [items, unread] = await Promise.all([
    prisma.notification.findMany({
      where: { userId: session.userId },
      orderBy: { createdAt: "desc" },
      take: MAX_ITEMS,
      select: {
        id: true,
        type: true,
        readAt: true,
        createdAt: true,
        emoji: true,
        media: true,
        tmdbId: true,
        title: true,
        detail: true,
        actor: { select: { id: true, name: true, avatarUrl: true } },
        activity: { select: { id: true, media: true, tmdbId: true } },
      },
    }),
    prisma.notification.count({ where: { userId: session.userId, readAt: null } }),
  ]);

  // Titre de l'œuvre visée par une réaction : la notification le cite.
  const reacted = items.flatMap((n) => (n.activity ? [n.activity] : []));
  const [films, series] = await Promise.all([
    getFilmCards(reacted.filter((a) => a.media === "movie").map((a) => a.tmdbId)),
    getSeriesCards(reacted.filter((a) => a.media === "tv").map((a) => a.tmdbId)),
  ]);

  return NextResponse.json({
    unread,
    items: items.map(({ activity, ...n }) => ({
      ...n,
      activity: activity && {
        id: activity.id,
        media: activity.media,
        title:
          activity.media === "tv"
            ? (series.get(activity.tmdbId)?.name ?? "une série")
            : (films.get(activity.tmdbId)?.title ?? "un film"),
      },
    })),
  });
}

/** Marque tout comme lu — appelé à l'ouverture du panneau. */
export async function POST() {
  const session = await getSession();
  if (!session) return new NextResponse(null, { status: 204 });

  await prisma.notification.updateMany({
    where: { userId: session.userId, readAt: null },
    data: { readAt: new Date() },
  });

  return new NextResponse(null, { status: 204 });
}
