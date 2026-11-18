import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/db";

/** Enregistre l'abonnement push de cet appareil (ou le rattache au compte courant). */
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as {
    endpoint?: unknown;
    keys?: { p256dh?: unknown; auth?: unknown };
  } | null;
  const endpoint = body?.endpoint;
  const p256dh = body?.keys?.p256dh;
  const auth = body?.keys?.auth;
  // L'adresse est appelée par le serveur à chaque envoi : seule une URL https
  // raisonnable est acceptée, jamais une adresse interne glissée par un client.
  const valid =
    typeof endpoint === "string" &&
    endpoint.length <= 1000 &&
    /^https:\/\/[^/\s]+\//.test(endpoint) &&
    typeof p256dh === "string" &&
    p256dh.length <= 200 &&
    typeof auth === "string" &&
    auth.length <= 100;
  if (!valid) return NextResponse.json({ error: "Abonnement invalide" }, { status: 400 });

  const userAgent = req.headers.get("user-agent")?.slice(0, 300) ?? null;
  await prisma.pushSubscription.upsert({
    where: { endpoint },
    create: { userId: session.userId, endpoint, p256dh, auth, userAgent },
    // Un appareil partagé qui change de compte ne doit notifier que le dernier.
    update: { userId: session.userId, p256dh, auth, userAgent },
  });
  return new NextResponse(null, { status: 204 });
}

/** Oublie l'abonnement de cet appareil. */
export async function DELETE(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  const body = (await req.json().catch(() => null)) as { endpoint?: unknown } | null;
  if (typeof body?.endpoint !== "string") {
    return NextResponse.json({ error: "Abonnement invalide" }, { status: 400 });
  }
  await prisma.pushSubscription.deleteMany({
    where: { endpoint: body.endpoint, userId: session.userId },
  });
  return new NextResponse(null, { status: 204 });
}
