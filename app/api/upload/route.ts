import { put, del } from "@vercel/blob";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/db";

/**
 * Supprime l'image précédente de l'utilisateur, retrouvée depuis l'URL encore
 * stockée en base (l'upload a lieu avant l'enregistrement du profil).
 * Best-effort : un échec ici ne doit pas faire échouer l'envoi.
 */
async function deletePreviousMedia(userId: string, type: "avatar" | "banner", token: string) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { avatarUrl: true, bannerUrl: true },
    });
    const previous = type === "avatar" ? user?.avatarUrl : user?.bannerUrl;
    const prefix = "/api/profile-media/";
    if (!previous?.startsWith(prefix)) return;

    // « /api/profile-media/avatar/<id>-<ts>.jpg » → « avatar/<id>-<ts>.jpg »
    const pathname = previous.slice(prefix.length).split("?")[0];
    await del(pathname, { token });
  } catch (error) {
    console.error("Suppression de l'ancienne image de profil impossible", error);
  }
}

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
  // Chemin UNIQUE à chaque envoi. Avant, on écrasait toujours `avatar/<id>.jpg`
  // et on ajoutait un `?v=` que la route de lecture ignore : elle relisait le
  // même objet, et l'optimiseur d'images de Next mettait en cache l'ancienne
  // image sous la nouvelle URL (max-age=3600) — d'où une photo qui ne se
  // rafraîchissait pas, même en rechargeant. Une URL = une image, pour toujours.
  const filename = `${type}/${session.userId}-${Date.now()}.${ext}`;
  const blobToken = process.env.BLOB_PROFIL_READ_WRITE_TOKEN ?? process.env.BLOB_READ_WRITE_TOKEN;

  if (blobToken) {
    try {
      const blob = await put(filename, file, {
        access: "private",
        token: blobToken,
        addRandomSuffix: false,
        allowOverwrite: true,
      });

      // L'ancienne image devient inutile : on la supprime pour ne pas empiler
      // les fichiers à chaque changement de photo (best-effort).
      await deletePreviousMedia(session.userId, type, blobToken);

      return NextResponse.json({ url: `/api/profile-media/${blob.pathname}` });
    } catch (error) {
      console.error("Profile image upload failed", error);
      return NextResponse.json(
        { error: "Upload impossible vers le stockage d'images" },
        { status: 500 },
      );
    }
  }

  if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { error: "Stockage d'images non configuré" },
      { status: 500 },
    );
  }

  const uploadDir = path.join(process.cwd(), "public", "uploads", "profile", type);
  await mkdir(uploadDir, { recursive: true });
  await writeFile(
    path.join(uploadDir, path.basename(filename)),
    Buffer.from(await file.arrayBuffer()),
  );

  return NextResponse.json({ url: `/uploads/profile/${filename}` });
}
