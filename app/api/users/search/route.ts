import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json([], { status: 401 });

  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) return NextResponse.json([]);

  const users = await prisma.user.findMany({
    where: {
      id: { not: session.userId },
      OR: [
        { name: { contains: q, mode: "insensitive" } },
        { email: { contains: q, mode: "insensitive" } },
      ],
    },
    select: {
      id: true,
      name: true,
      email: true,
      avatarUrl: true,
      _count: { select: { films: true } },
    },
    take: 8,
  });

  // Check which ones the current user already follows
  const following = await prisma.userFollow.findMany({
    where: { followerId: session.userId, followingId: { in: users.map((u) => u.id) } },
    select: { followingId: true },
  });
  const followingIds = new Set(following.map((f) => f.followingId));

  return NextResponse.json(
    users.map((u) => ({
      id: u.id,
      name: u.name ?? u.email.split("@")[0],
      avatarUrl: u.avatarUrl,
      filmCount: u._count.films,
      isFollowing: followingIds.has(u.id),
    }))
  );
}
