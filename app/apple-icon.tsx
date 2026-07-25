import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

// Icône « Ajouter à l'écran d'accueil » iOS : 180×180, fond opaque (sinon iOS
// remplit la transparence en noir). On centre le logo sur le fond du thème.
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default async function AppleIcon() {
  const logo = await readFile(join(process.cwd(), "public/logo.png"));
  const logoSrc = `data:image/png;base64,${logo.toString("base64")}`;

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
        <img src={logoSrc} width={120} height={109} alt="" />
      </div>
    ),
    { ...size },
  );
}
