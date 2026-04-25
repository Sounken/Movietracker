const BASE = "https://api.themoviedb.org/3";
export const IMG = "https://image.tmdb.org/t/p";

export type TmdbMovie = {
  id: number;
  title: string;
  overview: string;
  posterUrl: string;
  backdropUrl: string;
  year: string;
  voteAverage: number;
  genreIds: number[];
};

export type TmdbFilmDetail = {
  id: number;
  title: string;
  overview: string;
  posterUrl: string;
  backdropUrl: string;
  releaseDate: string;
  year: string;
  runtime: number | null;
  voteAverage: number;
  voteCount: number;
  popularity: number;
  genres: string[];
  budget: number;
  revenue: number;
  productionCompanies: string[];
};

export type TmdbCastMember = {
  id: number;
  name: string;
  character: string;
  profileUrl: string;
};

const GENRES: Record<number, string> = {
  28: "Action", 12: "Aventure", 16: "Animation", 35: "Comédie",
  80: "Crime", 99: "Documentaire", 18: "Drame", 10751: "Famille",
  14: "Fantastique", 36: "Histoire", 27: "Horreur", 10402: "Musique",
  9648: "Mystère", 10749: "Romance", 878: "Science-Fiction", 53: "Thriller",
  10752: "Guerre", 37: "Western",
};

export function genreLabels(ids: number[]): string[] {
  return ids.slice(0, 2).map((id) => GENRES[id]).filter(Boolean) as string[];
}

export function formatMoney(n: number): string {
  if (!n || n === 0) return "N/A";
  if (n >= 1e9) return (n / 1e9).toFixed(1) + " Md $";
  if (n >= 1e6) return (n / 1e6).toFixed(1) + " M $";
  return n.toLocaleString("fr") + " $";
}

export function formatRuntime(mins: number | null): string {
  if (!mins) return "N/A";
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}h${m.toString().padStart(2, "0")}` : `${m}min`;
}

export type TmdbFilmCard = {
  id: number;
  title: string;
  posterUrl: string;
  year: string;
  genres: string[];
};

export async function fetchFilmCard(id: number): Promise<TmdbFilmCard | null> {
  const key = process.env.TMDB_API_KEY;
  if (!key) return null;
  try {
    const res = await fetch(
      `${BASE}/movie/${id}?api_key=${key}&language=fr-FR`,
      { next: { revalidate: 86400 } }
    );
    if (!res.ok) return null;
    const m = await res.json();
    return {
      id: m.id,
      title: m.title ?? "",
      posterUrl: m.poster_path ? `${IMG}/w342${m.poster_path}` : "",
      year: m.release_date?.slice(0, 4) ?? "",
      genres: (m.genres ?? []).slice(0, 2).map((g: { name: string }) => g.name),
    };
  } catch {
    return null;
  }
}

export async function fetchNowPlaying(): Promise<TmdbMovie[]> {
  const key = process.env.TMDB_API_KEY;
  if (!key) return [];
  try {
    const res = await fetch(
      `${BASE}/movie/now_playing?api_key=${key}&language=fr-FR&region=FR`,
      { next: { revalidate: 3600 } }
    );
    if (!res.ok) return [];
    const data = await res.json();
    return (data.results ?? []).slice(0, 7).map((m: Record<string, unknown>) => ({
      id: m.id,
      title: m.title,
      overview: m.overview,
      posterUrl: m.poster_path ? `${IMG}/w500${m.poster_path}` : "",
      backdropUrl: m.backdrop_path ? `${IMG}/original${m.backdrop_path}` : "",
      year: typeof m.release_date === "string" ? m.release_date.slice(0, 4) : "",
      voteAverage: Math.round((m.vote_average as number) * 10) / 10,
      genreIds: (m.genre_ids as number[]) ?? [],
    }));
  } catch {
    return [];
  }
}

export async function fetchFilmDetail(id: number): Promise<TmdbFilmDetail | null> {
  const key = process.env.TMDB_API_KEY;
  if (!key) return null;
  try {
    const res = await fetch(
      `${BASE}/movie/${id}?api_key=${key}&language=fr-FR`,
      { next: { revalidate: 3600 } }
    );
    if (!res.ok) return null;
    const m = await res.json();
    return {
      id: m.id,
      title: m.title ?? "",
      overview: m.overview ?? "",
      posterUrl: m.poster_path ? `${IMG}/w500${m.poster_path}` : "",
      backdropUrl: m.backdrop_path ? `${IMG}/original${m.backdrop_path}` : "",
      releaseDate: m.release_date ?? "",
      year: m.release_date?.slice(0, 4) ?? "",
      runtime: m.runtime ?? null,
      voteAverage: Math.round((m.vote_average ?? 0) * 10) / 10,
      voteCount: m.vote_count ?? 0,
      popularity: Math.round((m.popularity ?? 0) * 10) / 10,
      genres: (m.genres ?? []).map((g: { name: string }) => g.name),
      budget: m.budget ?? 0,
      revenue: m.revenue ?? 0,
      productionCompanies: (m.production_companies ?? [])
        .slice(0, 5)
        .map((c: { name: string }) => c.name),
    };
  } catch {
    return null;
  }
}

export async function fetchFilmCredits(id: number): Promise<TmdbCastMember[]> {
  const key = process.env.TMDB_API_KEY;
  if (!key) return [];
  try {
    const res = await fetch(
      `${BASE}/movie/${id}/credits?api_key=${key}&language=fr-FR`,
      { next: { revalidate: 3600 } }
    );
    if (!res.ok) return [];
    const data = await res.json();
    return (data.cast ?? []).slice(0, 12).map((c: Record<string, unknown>) => ({
      id: c.id,
      name: c.name,
      character: c.character,
      profileUrl: c.profile_path ? `${IMG}/w185${c.profile_path}` : "",
    }));
  } catch {
    return [];
  }
}
