import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";

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
        actor: { select: { id: true, name: true, avatarUrl: true } },
      },
    }),
    prisma.notification.count({ where: { userId: session.userId, readAt: null } }),
  ]);

  return NextResponse.json({ items, unread });
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
