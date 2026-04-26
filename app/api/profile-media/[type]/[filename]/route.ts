import { get } from "@vercel/blob";
import { NextResponse } from "next/server";

const ALLOWED_TYPES = new Set(["avatar", "banner"]);
const ALLOWED_EXTENSIONS = new Set(["jpg", "jpeg", "png", "webp", "gif"]);

function getBlobToken() {
  return process.env.BLOB_PROFIL_READ_WRITE_TOKEN ?? process.env.BLOB_READ_WRITE_TOKEN;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ type: string; filename: string }> },
) {
  const { type, filename } = await params;
  const token = getBlobToken();

  if (!token) {
    return new NextResponse("Image storage is not configured", { status: 500 });
  }
  if (!ALLOWED_TYPES.has(type) || filename.includes("/") || filename.includes("..")) {
    return new NextResponse("Not found", { status: 404 });
  }

  const extension = filename.split(".").pop()?.toLowerCase();
  if (!extension || !ALLOWED_EXTENSIONS.has(extension)) {
    return new NextResponse("Not found", { status: 404 });
  }

  try {
    const result = await get(`${type}/${filename}`, {
      access: "private",
      token,
      headers: {
        "if-none-match": request.headers.get("if-none-match") ?? "",
      },
    });

    if (!result) return new NextResponse("Not found", { status: 404 });
    if (result.statusCode === 304) return new NextResponse(null, { status: 304 });

    return new NextResponse(result.stream, {
      headers: {
        "Content-Type": result.blob.contentType,
        "Cache-Control": "private, max-age=3600",
        ETag: result.blob.etag,
      },
    });
  } catch (error) {
    console.error("Profile image fetch failed", error);
    return new NextResponse("Not found", { status: 404 });
  }
}
