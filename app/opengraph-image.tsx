import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

// Aperçu affiché quand un lien MovieTracker est partagé (Discord, WhatsApp,
// X, iMessage…). Sans lui, le lien s'affiche nu : c'est souvent le premier
// contact d'un futur membre avec le site.
export const alt = "MovieTracker — journal de films et séries";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OpengraphImage() {
  const logo = await readFile(join(process.cwd(), "public/logo.png"));
  const logoSrc = `data:image/png;base64,${logo.toString("base64")}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "0 96px",
          background: "#0d0b0a",
          color: "#f4ece2",
        }}
      >
        <img src={logoSrc} width={132} height={120} alt="" />
        <div style={{ fontSize: 88, fontWeight: 700, marginTop: 40, letterSpacing: -2 }}>
          MovieTracker
        </div>
        <div style={{ fontSize: 40, color: "#a59689", marginTop: 16 }}>
          Votre journal de films et séries
        </div>
        <div style={{ display: "flex", gap: 16, marginTop: 48, fontSize: 28, color: "#f0a978" }}>
          Notez · Suivez vos épisodes · Jouez au Moviedle
        </div>
      </div>
    ),
    { ...size },
  );
}
