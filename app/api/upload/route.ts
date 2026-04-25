import { put } from "@vercel/blob";
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const form = await request.formData();
  const file = form.get("file") as File | null;
  const type = form.get("type") as string | null; // "avatar" | "banner"

  if (!file || !type) return NextResponse.json({ error: "Fichier manquant" }, { status: 400 });

  const ext = file.name.split(".").pop() ?? "jpg";
  const filename = `${type}/${session.userId}.${ext}`;

  const blob = await put(filename, file, {
    access: "public",
  });

  return NextResponse.json({ url: blob.url });
}
