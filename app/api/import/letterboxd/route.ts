import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import JSZip from "jszip";

const TMDB_KEY = process.env.TMDB_API_KEY;

// ——— CSV parser (handles quoted fields with embedded newlines and commas)
function parseCSV(content: string): Record<string, string>[] {
  const lines: string[][] = [];
  let current: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < content.length; i++) {
    const ch = content[i];
    const next = content[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') { field += '"'; i++; }
      else if (ch === '"') { inQuotes = false; }
      else { field += ch; }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        current.push(field); field = "";
      } else if (ch === "\n" || (ch === "\r" && next === "\n")) {
        if (ch === "\r") i++;
        current.push(field); field = "";
        if (current.some((c) => c.trim())) lines.push(current);
        current = [];
      } else {
        field += ch;
      }
    }
  }
  if (field || current.length > 0) { current.push(field); if (current.some(c => c.trim())) lines.push(current); }

  const [headers, ...rows] = lines;
  if (!headers) return [];
  return rows.map((row) =>
    Object.fromEntries(headers.map((h, i) => [h.trim(), (row[i] ?? "").trim()]))
  );
}

// ——— TMDB search: title + year, fallback without year
async function findTMDBId(name: string, year: string): Promise<number | null> {
  if (!TMDB_KEY) return null;

  const search = async (url: string) => {
    const res = await fetch(url, { next: { revalidate: 3600 } });
    if (!res.ok) return null;
    const data = await res.json();
    return (data.results as Array<{ id: number }>)?.[0]?.id ?? null;
  };

  const withYear = await search(
    `https://api.themoviedb.org/3/search/movie?api_key=${TMDB_KEY}&query=${encodeURIComponent(name)}&year=${year}&language=fr-FR`
  );
  if (withYear) return withYear;

  return search(
    `https://api.themoviedb.org/3/search/movie?api_key=${TMDB_KEY}&query=${encodeURIComponent(name)}&language=fr-FR`
  );
}

async function fetchRuntime(tmdbId: number): Promise<number | null> {
  if (!TMDB_KEY) return null;
  const res = await fetch(
    `https://api.themoviedb.org/3/movie/${tmdbId}?api_key=${TMDB_KEY}`,
    { next: { revalidate: 86400 } }
  );
  if (!res.ok) return null;
  const data = await res.json();
  return data.runtime ?? null;
}

type FilmData = {
  name: string;
  year: string;
  watched: boolean;
  watchedAt: string | null;
  rating: number | null;
  review: string | null;
  watchlist: boolean;
  liked: boolean;
};

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "Fichier manquant" }, { status: 400 });

  // Load ZIP
  const buffer = Buffer.from(await file.arrayBuffer());
  const zip = await JSZip.loadAsync(buffer);

  async function readCSV(path: string): Promise<Record<string, string>[]> {
    const entry = zip.file(path);
    if (!entry) return [];
    return parseCSV(await entry.async("string"));
  }

  const [watched, ratings, reviews, watchlist, likedFilms] = await Promise.all([
    readCSV("watched.csv"),
    readCSV("ratings.csv"),
    readCSV("reviews.csv"),
    readCSV("watchlist.csv"),
    readCSV("likes/films.csv"),
  ]);

  // ——— Merge all sources by Name+Year
  const filmMap = new Map<string, FilmData>();

  function key(name: string, year: string) {
    return `${name.toLowerCase()}:${year}`;
  }
  function getOrCreate(name: string, year: string): FilmData {
    const k = key(name, year);
    if (!filmMap.has(k)) {
      filmMap.set(k, { name, year, watched: false, watchedAt: null, rating: null, review: null, watchlist: false, liked: false });
    }
    return filmMap.get(k)!;
  }

  for (const row of watched) {
    if (!row.Name) continue;
    const f = getOrCreate(row.Name, row.Year);
    f.watched = true;
    if (row.Date && !f.watchedAt) f.watchedAt = row.Date;
  }
  for (const row of ratings) {
    if (!row.Name) continue;
    const f = getOrCreate(row.Name, row.Year);
    f.watched = true;
    if (row.Rating) f.rating = parseFloat(row.Rating) * 2;
  }
  for (const row of reviews) {
    if (!row.Name) continue;
    const f = getOrCreate(row.Name, row.Year);
    f.watched = true;
    if (row.Rating && !f.rating) f.rating = parseFloat(row.Rating) * 2;
    if (row.Review) f.review = row.Review;
    if (row["Watched Date"]) f.watchedAt = row["Watched Date"];
  }
  for (const row of watchlist) {
    if (!row.Name) continue;
    getOrCreate(row.Name, row.Year).watchlist = true;
  }
  for (const row of likedFilms) {
    if (!row.Name) continue;
    getOrCreate(row.Name, row.Year).liked = true;
  }

  const films = Array.from(filmMap.values());

  // ——— Process in batches of 8 (TMDB rate-limit friendly)
  let imported = 0;
  let skipped = 0;
  const BATCH = 8;

  for (let i = 0; i < films.length; i += BATCH) {
    await Promise.all(
      films.slice(i, i + BATCH).map(async (film) => {
        const tmdbId = await findTMDBId(film.name, film.year);
        if (!tmdbId) { skipped++; return; }

        const runtime = film.watched ? await fetchRuntime(tmdbId) : null;

        await prisma.userFilm.upsert({
          where: { userId_tmdbId: { userId: session.userId, tmdbId } },
          create: {
            userId: session.userId,
            tmdbId,
            watched: film.watched,
            watchedAt: film.watchedAt ? new Date(film.watchedAt) : null,
            rating: film.rating,
            review: film.review,
            watchlist: film.watchlist,
            liked: film.liked,
            runtime,
          },
          update: {
            ...(film.watched && { watched: true }),
            ...(film.watchedAt && { watchedAt: new Date(film.watchedAt) }),
            ...(film.rating != null && { rating: film.rating }),
            ...(film.review && { review: film.review }),
            ...(film.watchlist && { watchlist: true }),
            ...(film.liked && { liked: true }),
            ...(runtime != null && { runtime }),
          },
        });
        imported++;
      })
    );

    // 150ms between batches to stay within TMDB rate limits
    if (i + BATCH < films.length) {
      await new Promise((r) => setTimeout(r, 150));
    }
  }

  return NextResponse.json({ imported, skipped, total: films.length });
}
