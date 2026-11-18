/* eslint-disable @next/next/no-img-element -- l'image est rendue par Satori, qui ne connaît que <img>. */
import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import { bilanYears, computeBilan, formatDuration } from "@/lib/bilan";
import { formatRatingOutOf, toRatingScale } from "@/lib/rating";
import { SITE_URL } from "@/lib/site";

/**
 * Image du bilan, au format story (1080 × 1920), pour Instagram, WhatsApp…
 *
 * Réservée au titulaire du compte : elle se partage comme un fichier, pas
 * comme un lien, et le bilan reste privé dans l'application.
 */
const C = {
  bg: "#0d0b0a",
  panel: "#1a1614",
  line: "#2a221f",
  ink: "#f4ece2",
  dim: "#a59689",
  accent: "#d97742",
  gold: "#e8c98a",
};

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const years = await bilanYears(session.userId);
  const asked = Number(req.nextUrl.searchParams.get("annee"));
  const year = years.includes(asked) ? asked : years[0];

  const [bilan, user, logo] = await Promise.all([
    computeBilan(session.userId, year),
    prisma.user.findUnique({ where: { id: session.userId }, select: { ratingScale: true } }),
    readFile(join(process.cwd(), "public/logo.png")),
  ]);
  const scale = toRatingScale(user?.ratingScale);
  const logoSrc = `data:image/png;base64,${logo.toString("base64")}`;
  const { films, series } = bilan;

  const stats = [
    { value: String(films.count), label: films.count > 1 ? "films vus" : "film vu" },
    { value: formatDuration(films.minutes + series.minutes), label: "devant l'écran" },
    { value: String(series.episodes), label: series.episodes > 1 ? "épisodes" : "épisode" },
    {
      value: films.avgRating != null ? formatRatingOutOf(films.avgRating, scale) : "—",
      label: "note moyenne",
    },
  ];
  const top = bilan.topFilms.slice(0, 3);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          padding: "96px 84px 80px",
          background: C.bg,
          color: C.ink,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <img src={logoSrc} width={77} height={70} alt="" />
          <div style={{ fontSize: 40, fontWeight: 700 }}>MovieTracker</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", marginTop: 90 }}>
          <div style={{ fontSize: 36, letterSpacing: 8, color: C.dim }}>MON ANNÉE</div>
          <div style={{ fontSize: 220, fontWeight: 700, color: C.accent, lineHeight: 1, letterSpacing: -6 }}>
            {String(year)}
          </div>
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 24, marginTop: 64 }}>
          {stats.map((s) => (
            <div
              key={s.label}
              style={{
                display: "flex",
                flexDirection: "column",
                width: 444,
                padding: "30px 34px",
                background: C.panel,
                border: `2px solid ${C.line}`,
                borderRadius: 28,
              }}
            >
              <div style={{ fontSize: 72, fontWeight: 700 }}>{s.value}</div>
              <div style={{ fontSize: 30, color: C.dim, marginTop: 4 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {top.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", marginTop: 64 }}>
            <div style={{ fontSize: 30, letterSpacing: 6, color: C.dim }}>MES PRÉFÉRÉS</div>
            <div style={{ display: "flex", gap: 24, marginTop: 24 }}>
              {top.map((f) => (
                <div key={f.tmdbId} style={{ display: "flex", flexDirection: "column", width: 288 }}>
                  {f.posterUrl ? (
                    <img
                      src={f.posterUrl}
                      width={288}
                      height={432}
                      alt=""
                      style={{ borderRadius: 20, objectFit: "cover" }}
                    />
                  ) : (
                    <div style={{ width: 288, height: 432, borderRadius: 20, background: C.panel }} />
                  )}
                  <div
                    style={{
                      fontSize: 28,
                      marginTop: 14,
                      overflow: "hidden",
                      whiteSpace: "nowrap",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {f.title}
                  </div>
                  {/* L'étoile est dessinée : la police par défaut de Satori n'a pas
                      le glyphe ★, et le télécharger à la volée échoue. */}
                  <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 26, color: C.gold }}>
                    <svg width="24" height="24" viewBox="0 0 24 24">
                      <path
                        fill={C.gold}
                        d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.3 1.3-6.6-4.9-4.6 6.6-.8z"
                      />
                    </svg>
                    {formatRatingOutOf(f.rating, scale)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div style={{ display: "flex", marginTop: "auto", justifyContent: "space-between", alignItems: "flex-end" }}>
          <div style={{ display: "flex", flexDirection: "column", fontSize: 30, color: C.dim }}>
            {bilan.genres.length > 0 && (
              <div style={{ display: "flex" }}>
                {`Genres : ${bilan.genres.slice(0, 3).map((g) => g.name).join(" · ")}`}
              </div>
            )}
          </div>
          <div style={{ fontSize: 30, color: C.accent }}>{SITE_URL.replace(/^https?:\/\//, "")}</div>
        </div>
      </div>
    ),
    {
      width: 1080,
      height: 1920,
      headers: { "Cache-Control": "private, no-store" },
    },
  );
}
