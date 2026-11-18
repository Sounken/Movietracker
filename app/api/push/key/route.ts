import { NextResponse } from "next/server";
import { vapidPublicKey } from "@/lib/push";

/**
 * Clé publique VAPID, lue à l'exécution : en `NEXT_PUBLIC_*`, elle serait
 * figée dans le build et demanderait un argument de build Coolify de plus.
 */
export function GET() {
  const publicKey = vapidPublicKey();
  if (!publicKey) return NextResponse.json({ error: "Push non configuré" }, { status: 404 });
  return NextResponse.json({ publicKey }, { headers: { "Cache-Control": "public, max-age=3600" } });
}
