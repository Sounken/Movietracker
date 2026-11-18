import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { sendPushes } from "@/lib/push";

/** « Envoyer une notification de test » depuis les réglages. */
export async function POST() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  const sent = await sendPushes(
    [
      {
        userId: session.userId,
        category: "social",
        payload: {
          title: "MovieTracker",
          body: "Les notifications fonctionnent sur cet appareil.",
          url: "/settings",
          tag: "test",
        },
      },
    ],
    { ignorePreferences: true },
  );
  return NextResponse.json({ sent });
}
