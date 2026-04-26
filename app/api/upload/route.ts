import { put } from "@vercel/blob";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";

const ALLOWED_TYPES = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
  ["image/gif", "gif"],
]);

const MAX_FILE_SIZE = 5 * 1024 * 1024;

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const form = await request.formData();
  const file = form.get("file") as File | null;
  const type = form.get("type") as string | null; // "avatar" | "banner"

  if (!file || !type) return NextResponse.json({ error: "Fichier manquant" }, { status: 400 });
  if (type !== "avatar" && type !== "banner") {
    return NextResponse.json({ error: "Type d'upload invalide" }, { status: 400 });
  }
  if (!ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json({ error: "Format d'image non supporté" }, { status: 400 });
  }
  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: "Image trop lourde (5 Mo max)" }, { status: 400 });
  }

  const ext = ALLOWED_TYPES.get(file.type) ?? "jpg";
  const filename = `${type}/${session.userId}.${ext}`;

  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const blob = await put(filename, file, {
      access: "public",
    });

    return NextResponse.json({ url: blob.url });
  }

  if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { error: "Stockage d'images non configuré" },
      { status: 500 },
    );
  }

  const uploadDir = path.join(process.cwd(), "public", "uploads", "profile", type);
  await mkdir(uploadDir, { recursive: true });
  await writeFile(path.join(uploadDir, `${session.userId}.${ext}`), Buffer.from(await file.arrayBuffer()));

  return NextResponse.json({ url: `/uploads/profile/${filename}?v=${Date.now()}` });
}
