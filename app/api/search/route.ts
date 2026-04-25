import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q");
  if (!q || q.length < 2) return NextResponse.json([]);

  const key = process.env.TMDB_API_KEY;
  if (!key) return NextResponse.json([]);

  const tmdbRes = await fetch(
    `https://api.themoviedb.org/3/search/movie?api_key=${key}&query=${encodeURIComponent(q)}&language=fr-FR`,
    { next: { revalidate: 300 } }
  );

  if (!tmdbRes.ok) return NextResponse.json([]);

  const data = await tmdbRes.json();
  const results = ((data.results ?? []) as Record<string, unknown>[])
    .sort((a, b) => (b.popularity as number) - (a.popularity as number))
    .slice(0, 6)
    .map((m) => ({
      id: m.id,
      title: m.title,
      year: typeof m.release_date === "string" ? m.release_date.slice(0, 4) : "",
      posterUrl: m.poster_path ? `https://image.tmdb.org/t/p/w92${m.poster_path}` : "",
      voteAverage: m.vote_average ? Math.round((m.vote_average as number) * 10) / 10 : null,
    }));

  return NextResponse.json(results);
}
