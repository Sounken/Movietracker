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
  originalTitle: string;
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
  originalLanguage: string;
  spokenLanguages: string[];
  productionCountries: string[];
};

export type TmdbPerson = {
  id: number;
  name: string;
  biography: string;
  birthday: string | null;
  deathday: string | null;
  placeOfBirth: string | null;
  profileUrl: string;
  knownForDepartment: string;
  popularity: number;
  imdbId: string | null;
  instagramId: string | null;
  twitterId: string | null;
  alsoKnownAs: string[];
};

export type TmdbPersonCredit = {
  id: number;
  title: string;
  character: string;
  posterUrl: string;
  year: string;
  voteAverage: number;
  voteCount: number;
  popularity: number;
};

export type TmdbCrewMember = { id: number; name: string };

export type TmdbCredits = {
  cast: TmdbCastMember[];
  directors: TmdbCrewMember[];
  writers: TmdbCrewMember[];
};

export type TmdbCastMember = {
  id: number;
  name: string;
  character: string;
  profileUrl: string;
};

export const GENRES: Record<number, string> = {
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
  voteAverage: number;
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
      voteAverage: m.vote_average ? Math.round((m.vote_average as number) * 10) / 10 : 0,
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
      originalTitle: m.original_title ?? "",
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
      originalLanguage: m.original_language ?? "",
      spokenLanguages: (m.spoken_languages ?? []).map((l: { name: string }) => l.name),
      productionCountries: (m.production_countries ?? []).map((c: { name: string }) => c.name),
    };
  } catch {
    return null;
  }
}

export type TmdbDiscoverFilm = {
  id: number;
  title: string;
  year: string;
  posterUrl: string;
  voteAverage: number;
};

export async function fetchDiscover(
  category: string,
  genreId: number | null,
  page: number = 1,
): Promise<TmdbDiscoverFilm[]> {
  const key = process.env.TMDB_API_KEY;
  if (!key) return [];
  try {
    const today = new Date().toISOString().split("T")[0];
    const past45 = new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
    const future90 = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

    let extra = "";
    if (category === "top_rated") {
      extra = "&sort_by=vote_average.desc&vote_count.gte=300";
    } else if (category === "now_playing") {
      extra = `&sort_by=popularity.desc&primary_release_date.gte=${past45}&primary_release_date.lte=${today}`;
    } else if (category === "upcoming") {
      extra = `&sort_by=popularity.desc&primary_release_date.gte=${today}&primary_release_date.lte=${future90}`;
    } else {
      extra = "&sort_by=popularity.desc";
    }
    if (genreId) extra += `&with_genres=${genreId}`;

    const url = `${BASE}/discover/movie?api_key=${key}&language=fr-FR&page=${page}${extra}`;
    const res = await fetch(url, { next: { revalidate: 3600 } });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.results ?? []).map((m: Record<string, unknown>) => ({
      id: m.id,
      title: m.title,
      year: typeof m.release_date === "string" ? m.release_date.slice(0, 4) : "",
      posterUrl: m.poster_path ? `${IMG}/w342${m.poster_path}` : "",
      voteAverage: m.vote_average ? Math.round((m.vote_average as number) * 10) / 10 : 0,
    }));
  } catch {
    return [];
  }
}

export async function fetchFilmCredits(id: number): Promise<TmdbCredits> {
  const key = process.env.TMDB_API_KEY;
  if (!key) return { cast: [], directors: [], writers: [] };
  try {
    const res = await fetch(
      `${BASE}/movie/${id}/credits?api_key=${key}&language=fr-FR`,
      { next: { revalidate: 3600 } }
    );
    if (!res.ok) return { cast: [], directors: [], writers: [] };
    const data = await res.json();
    const cast: TmdbCastMember[] = (data.cast ?? []).slice(0, 20).map((c: Record<string, unknown>) => ({
      id: c.id,
      name: c.name,
      character: c.character,
      profileUrl: c.profile_path ? `${IMG}/w185${c.profile_path}` : "",
    }));
    const crew: Array<{ id: number; name: string; job: string; department: string }> = data.crew ?? [];
    const directors = crew.filter((c) => c.job === "Director").map((c) => ({ id: c.id, name: c.name }));
    const seen = new Set<number>();
    const writers = crew
      .filter((c) => c.department === "Writing" && ["Screenplay", "Writer", "Story"].includes(c.job))
      .filter((c) => { if (seen.has(c.id)) return false; seen.add(c.id); return true; })
      .slice(0, 4)
      .map((c) => ({ id: c.id, name: c.name }));
    return { cast, directors, writers };
  } catch {
    return { cast: [], directors: [], writers: [] };
  }
}

export async function fetchSimilarFilms(id: number): Promise<TmdbFilmCard[]> {
  const key = process.env.TMDB_API_KEY;
  if (!key) return [];
  try {
    const res = await fetch(
      `${BASE}/movie/${id}/recommendations?api_key=${key}&language=fr-FR&page=1`,
      { next: { revalidate: 86400 } }
    );
    if (!res.ok) return [];
    const data = await res.json();
    return (data.results ?? []).slice(0, 8).map((m: Record<string, unknown>) => ({
      id: m.id,
      title: m.title,
      posterUrl: m.poster_path ? `${IMG}/w342${m.poster_path}` : "",
      year: typeof m.release_date === "string" ? m.release_date.slice(0, 4) : "",
      genres: ((m.genre_ids as number[]) ?? []).slice(0, 2).map((gid) => GENRES[gid]).filter(Boolean),
    }));
  } catch {
    return [];
  }
}

export async function fetchFilmKeywords(id: number): Promise<string[]> {
  const key = process.env.TMDB_API_KEY;
  if (!key) return [];
  try {
    const res = await fetch(
      `${BASE}/movie/${id}/keywords?api_key=${key}`,
      { next: { revalidate: 86400 } }
    );
    if (!res.ok) return [];
    const data = await res.json();
    return (data.keywords ?? []).map((k: { name: string }) => k.name as string);
  } catch {
    return [];
  }
}

export async function fetchPersonDetail(id: number): Promise<TmdbPerson | null> {
  const key = process.env.TMDB_API_KEY;
  if (!key) return null;
  try {
    const res = await fetch(
      `${BASE}/person/${id}?api_key=${key}&language=fr-FR&append_to_response=external_ids`,
      { next: { revalidate: 86400 } }
    );
    if (!res.ok) return null;
    const p = await res.json();
    return {
      id: p.id,
      name: p.name ?? "",
      biography: p.biography ?? "",
      birthday: p.birthday ?? null,
      deathday: p.deathday ?? null,
      placeOfBirth: p.place_of_birth ?? null,
      profileUrl: p.profile_path ? `${IMG}/w500${p.profile_path}` : "",
      knownForDepartment: p.known_for_department ?? "",
      popularity: Math.round((p.popularity ?? 0) * 10) / 10,
      imdbId: p.external_ids?.imdb_id ?? p.imdb_id ?? null,
      instagramId: p.external_ids?.instagram_id ?? null,
      twitterId: p.external_ids?.twitter_id ?? null,
      alsoKnownAs: (p.also_known_as ?? []).slice(0, 4),
    };
  } catch {
    return null;
  }
}

export async function fetchPersonCredits(id: number): Promise<TmdbPersonCredit[]> {
  const key = process.env.TMDB_API_KEY;
  if (!key) return [];
  try {
    const res = await fetch(
      `${BASE}/person/${id}/movie_credits?api_key=${key}&language=fr-FR`,
      { next: { revalidate: 86400 } }
    );
    if (!res.ok) return [];
    const data = await res.json();
    return (data.cast ?? [])
      .filter((m: Record<string, unknown>) => m.poster_path)
      .sort((a: Record<string, unknown>, b: Record<string, unknown>) =>
        (b.vote_count as number) - (a.vote_count as number)
      )
      .map((m: Record<string, unknown>) => ({
        id: m.id,
        title: m.title,
        character: m.character ?? "",
        posterUrl: m.poster_path ? `${IMG}/w342${m.poster_path}` : "",
        year: typeof m.release_date === "string" ? m.release_date.slice(0, 4) : "",
        voteAverage: m.vote_average ? Math.round((m.vote_average as number) * 10) / 10 : 0,
        voteCount: (m.vote_count as number) ?? 0,
        popularity: typeof m.popularity === "number" ? Math.round(m.popularity * 10) / 10 : 0,
      }));
  } catch {
    return [];
  }
}

const RANK_PAGES = 250; // top 5000 actors

export async function fetchPersonPopularRank(id: number): Promise<number | null> {
  const key = process.env.TMDB_API_KEY;
  if (!key) return null;
  try {
    const pageNums = Array.from({ length: RANK_PAGES }, (_, i) => i + 1);
    const pages = await Promise.all(
      pageNums.map((page) =>
        fetch(`${BASE}/person/popular?api_key=${key}&page=${page}`, { next: { revalidate: 86400 } })
          .then((r) => r.ok ? r.json() : { results: [] })
      )
    );
    const all = pages.flatMap((p) => (p.results ?? []) as { id: number }[]);
    const idx = all.findIndex((p) => p.id === id);
    return idx !== -1 ? idx + 1 : null;
  } catch {
    return null;
  }
}
