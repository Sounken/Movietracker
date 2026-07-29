import { NextRequest, NextResponse } from "next/server";

const IMG = "https://image.tmdb.org/t/p/w185";

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q");
  const type = request.nextUrl.searchParams.get("type"); // "multi" = films + séries
  if (!q || q.length < 2) return NextResponse.json([]);

  const key = process.env.TMDB_API_KEY;
  if (!key) return NextResponse.json([]);

  const url = (kind: string) =>
    `https://api.themoviedb.org/3/search/${kind}?api_key=${key}&query=${encodeURIComponent(q)}&language=fr-FR`;

  // ——— Recherche séries uniquement (picker séries préférées) ———
  if (type === "tv") {
    const res = await fetch(url("tv"), { next: { revalidate: 300 } });
    if (!res.ok) return NextResponse.json([]);
    const data = await res.json();
    const results = ((data.results ?? []) as Record<string, unknown>[])
      .sort((a, b) => (b.popularity as number) - (a.popularity as number))
      .slice(0, 6)
      .map((m) => ({
        id: m.id,
        title: m.name,
        year: typeof m.first_air_date === "string" ? m.first_air_date.slice(0, 4) : "",
        posterUrl: m.poster_path ? `${IMG}${m.poster_path}` : "",
        voteAverage: m.vote_average ? Math.round((m.vote_average as number) * 10) / 10 : null,
      }));
    return NextResponse.json(results);
  }

  // ——— Recherche films uniquement (comportement historique) ———
  if (type !== "multi") {
    const res = await fetch(url("movie"), { next: { revalidate: 300 } });
    if (!res.ok) return NextResponse.json([]);
    const data = await res.json();
    const results = ((data.results ?? []) as Record<string, unknown>[])
      .sort((a, b) => (b.popularity as number) - (a.popularity as number))
      .slice(0, 6)
      .map((m) => ({
        id: m.id,
        title: m.title,
        year: typeof m.release_date === "string" ? m.release_date.slice(0, 4) : "",
        posterUrl: m.poster_path ? `${IMG}${m.poster_path}` : "",
        voteAverage: m.vote_average ? Math.round((m.vote_average as number) * 10) / 10 : null,
      }));
    return NextResponse.json(results);
  }

  // ——— Recherche multi : films + séries, triés par popularité ———
  const [movieRes, tvRes] = await Promise.all([
    fetch(url("movie"), { next: { revalidate: 300 } }),
    fetch(url("tv"), { next: { revalidate: 300 } }),
  ]);
  const movieData = movieRes.ok ? await movieRes.json() : { results: [] };
  const tvData = tvRes.ok ? await tvRes.json() : { results: [] };

  const movies = ((movieData.results ?? []) as Record<string, unknown>[]).map((m) => ({
    id: m.id,
    mediaType: "movie" as const,
    title: m.title as string,
    year: typeof m.release_date === "string" ? m.release_date.slice(0, 4) : "",
    posterUrl: m.poster_path ? `${IMG}${m.poster_path}` : "",
    voteAverage: m.vote_average ? Math.round((m.vote_average as number) * 10) / 10 : null,
    popularity: (m.popularity as number) ?? 0,
  }));

  const series = ((tvData.results ?? []) as Record<string, unknown>[]).map((s) => ({
    id: s.id,
    mediaType: "tv" as const,
    title: s.name as string,
    year: typeof s.first_air_date === "string" ? s.first_air_date.slice(0, 4) : "",
    posterUrl: s.poster_path ? `${IMG}${s.poster_path}` : "",
    voteAverage: s.vote_average ? Math.round((s.vote_average as number) * 10) / 10 : null,
    popularity: (s.popularity as number) ?? 0,
  }));

  const merged = [...movies, ...series]
    .sort((a, b) => b.popularity - a.popularity)
    .slice(0, 8)
    .map((r) => ({
      id: r.id,
      mediaType: r.mediaType,
      title: r.title,
      year: r.year,
      posterUrl: r.posterUrl,
      voteAverage: r.voteAverage,
    }));

  return NextResponse.json(merged);
}
