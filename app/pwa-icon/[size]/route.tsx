/* eslint-disable @next/next/no-img-element -- l'image est rendue par Satori, qui ne connaît que <img>. */
import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

/**
 * Icônes de l'application installée (manifeste, notifications).
 *
 * Android n'installe une PWA qu'avec des icônes 192 et 512 px ; le logo du
 * dépôt fait 170 px. Fond opaque et logo à 60 % : la zone sûre d'une icône
 * « maskable » (découpée en cercle ou en goutte) en garde tout.
 */
const SIZES = [96, 192, 512];

export function generateStaticParams() {
  return SIZES.map((size) => ({ size: String(size) }));
}

export async function GET(_req: Request, { params }: { params: Promise<{ size: string }> }) {
  const size = Number((await params).size);
  if (!SIZES.includes(size)) return new Response("Not found", { status: 404 });

  const logo = await readFile(join(process.cwd(), "public/logo.png"));
  const logoSrc = `data:image/png;base64,${logo.toString("base64")}`;
  const width = Math.round(size * 0.6);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0d0b0a",
        }}
      >
        <img src={logoSrc} width={width} height={Math.round((width * 155) / 170)} alt="" />
      </div>
    ),
    { width: size, height: size, headers: { "Cache-Control": "public, max-age=604800, immutable" } },
  );
}
