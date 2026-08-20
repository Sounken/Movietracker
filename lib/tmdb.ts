import { unstable_cache } from "next/cache";

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
  /** Saga TMDB à laquelle le film appartient (« Star Wars — La Saga »…). */
  collectionId: number | null;
  collectionName: string;
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

/** Grande famille de métier, pour filtrer la filmographie. */
export type CreditDepartment = "directing" | "writing" | "production" | "acting" | "other";

export type TmdbPersonCredit = {
  id: number;
  title: string;
  character: string;
  posterUrl: string;
  year: string;
  voteAverage: number;
  voteCount: number;
  popularity: number;
  department: CreditDepartment;
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

type TmdbLogo = {
  file_path: string;
  iso_639_1: string | null;
  aspect_ratio: number;
  vote_average: number;
};

// Logo officiel du film (le titre en image). Renvoie null s'il n'y en a pas
// d'exploitable — l'appelant retombe alors sur le titre texte.
export async function fetchFilmLogo(id: number): Promise<string | null> {
  const key = process.env.TMDB_API_KEY;
  if (!key) return null;
  try {
    const res = await fetch(
      `${BASE}/movie/${id}/images?api_key=${key}&include_image_language=fr,en,null`,
      { next: { revalidate: 86400 } },
    );
    if (!res.ok) return null;
    const data = await res.json();

    const logos = (data.logos ?? []) as TmdbLogo[];

    // On ne garde que les logos nettement horizontaux (un logo haut/étroit
    // rendrait mal dans le bandeau) et en PNG (fond transparent, taille gérable).
    const usable = logos.filter(
      (l) => l.aspect_ratio >= 1.2 && l.file_path.toLowerCase().endsWith(".png"),
    );
    if (usable.length === 0) return null;

    // Priorité : français → anglais → sans langue ; puis le mieux noté.
    const bestFor = (lang: string | null) =>
      usable
        .filter((l) => l.iso_639_1 === lang)
        .sort((a, b) => b.vote_average - a.vote_average)[0];

    const best = bestFor("fr") ?? bestFor("en") ?? bestFor(null) ?? usable[0];
    return best ? `${IMG}/w500${best.file_path}` : null;
  } catch {
    return null;
  }
}

// Séries à l'affiche pour le carrousel de l'accueil séries (même forme que
// fetchNowPlaying pour réutiliser le HeroCarousel : title = nom de la série).
export async function fetchOnTheAirSeries(): Promise<TmdbMovie[]> {
  const key = process.env.TMDB_API_KEY;
  if (!key) return [];
  try {
    const res = await fetch(
      `${BASE}/tv/on_the_air?api_key=${key}&language=fr-FR`,
      { next: { revalidate: 3600 } },
    );
    if (!res.ok) return [];
    const data = await res.json();
    return (data.results ?? [])
      .filter((m: Record<string, unknown>) => m.backdrop_path)
      .slice(0, 7)
      .map((m: Record<string, unknown>) => ({
        id: m.id,
        title: m.name,
        overview: m.overview,
        posterUrl: m.poster_path ? `${IMG}/w500${m.poster_path}` : "",
        backdropUrl: m.backdrop_path ? `${IMG}/original${m.backdrop_path}` : "",
        year: typeof m.first_air_date === "string" ? m.first_air_date.slice(0, 4) : "",
        voteAverage: Math.round((m.vote_average as number) * 10) / 10,
        genreIds: (m.genre_ids as number[]) ?? [],
      }));
  } catch {
    return [];
  }
}

/**
 * Récupère une fiche TMDB en distinguant deux cas que le code confondait :
 *  - un vrai 404 → la fiche n'existe pas → `null` → l'appelant fait notFound()
 *  - une panne passagère (429, 5xx, timeout) → on réessaie une fois, puis on
 *    lève l'erreur.
 *
 * Avant, `if (!res.ok) return null` renvoyait `null` dans les deux cas : une
 * hoquet de TMDB affichait donc une page 404 définitive pour un film qui
 * existe. Une erreur levée donne au contraire un écran réessayable et se voit
 * dans les logs.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- payload TMDB brut, typé par l'appelant
async function fetchTmdbDetail(path: string): Promise<any | null> {
  const key = process.env.TMDB_API_KEY;
  if (!key) throw new Error("TMDB_API_KEY manquante");

  const url = `${BASE}${path}?api_key=${key}&language=fr-FR`;
  let lastError: unknown;

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(url, { next: { revalidate: 3600 } });
      if (res.status === 404) return null;
      if (res.ok) return await res.json();
      lastError = new Error(`TMDB a répondu ${res.status} sur ${path}`);
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError instanceof Error ? lastError : new Error(`TMDB injoignable sur ${path}`);
}

export async function fetchFilmDetail(id: number): Promise<TmdbFilmDetail | null> {
  const m = await fetchTmdbDetail(`/movie/${id}`);
  if (!m) return null;
  {
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
      collectionId: m.belongs_to_collection?.id ?? null,
      collectionName: m.belongs_to_collection?.name ?? "",
      spokenLanguages: (m.spoken_languages ?? []).map((l: { name: string }) => l.name),
      productionCountries: (m.production_countries ?? []).map((c: { name: string }) => c.name),
    };
  }
}

// ——————————————————————————————————————————————————————————————
//  Séries TV (endpoints tv/*)
// ——————————————————————————————————————————————————————————————

export type TmdbSeriesCard = {
  id: number;
  name: string;
  posterUrl: string;
  year: string;
  genres: string[];
  voteAverage: number;
};

export type TmdbSeasonSummary = {
  seasonNumber: number;
  name: string;
  episodeCount: number;
  posterUrl: string;
  year: string;
};

export type TmdbSeriesDetail = {
  id: number;
  name: string;
  overview: string;
  posterUrl: string;
  backdropUrl: string;
  year: string;
  lastAirDate: string;
  status: string;
  numberOfSeasons: number;
  numberOfEpisodes: number;
  episodeRunTime: number | null;
  voteAverage: number;
  voteCount: number;
  genres: string[];
  networks: string[];
  originalLanguage: string;
  seasons: TmdbSeasonSummary[];
};

export type TmdbEpisode = {
  episodeNumber: number;
  name: string;
  overview: string;
  stillUrl: string;
  airDate: string;
  runtime: number | null;
  voteAverage: number;
};

export async function fetchSeriesCard(id: number): Promise<TmdbSeriesCard | null> {
  const key = process.env.TMDB_API_KEY;
  if (!key) return null;
  try {
    const res = await fetch(`${BASE}/tv/${id}?api_key=${key}&language=fr-FR`, {
      next: { revalidate: 86400 },
    });
    if (!res.ok) return null;
    const m = await res.json();
    return {
      id: m.id,
      name: m.name ?? "",
      posterUrl: m.poster_path ? `${IMG}/w342${m.poster_path}` : "",
      year: m.first_air_date?.slice(0, 4) ?? "",
      genres: (m.genres ?? []).slice(0, 2).map((g: { name: string }) => g.name),
      voteAverage: m.vote_average ? Math.round((m.vote_average as number) * 10) / 10 : 0,
    };
  } catch {
    return null;
  }
}

export async function fetchSeriesDetail(id: number): Promise<TmdbSeriesDetail | null> {
  // Même distinction 404 / panne passagère que pour les films.
  const m = await fetchTmdbDetail(`/tv/${id}`);
  if (!m) return null;
  {
    const runTimes: number[] = m.episode_run_time ?? [];
    return {
      id: m.id,
      name: m.name ?? "",
      overview: m.overview ?? "",
      posterUrl: m.poster_path ? `${IMG}/w500${m.poster_path}` : "",
      backdropUrl: m.backdrop_path ? `${IMG}/original${m.backdrop_path}` : "",
      year: m.first_air_date?.slice(0, 4) ?? "",
      lastAirDate: m.last_air_date ?? "",
      status: m.status ?? "",
      numberOfSeasons: m.number_of_seasons ?? 0,
      numberOfEpisodes: m.number_of_episodes ?? 0,
      episodeRunTime: runTimes.length > 0 ? runTimes[0] : null,
      voteAverage: Math.round((m.vote_average ?? 0) * 10) / 10,
      voteCount: m.vote_count ?? 0,
      genres: (m.genres ?? []).map((g: { name: string }) => g.name),
      networks: (m.networks ?? []).slice(0, 4).map((n: { name: string }) => n.name),
      originalLanguage: m.original_language ?? "",
      // on garde les saisons ayant au moins un épisode (saison 0 = spéciaux inclus)
      seasons: (m.seasons ?? [])
        .filter((s: { episode_count: number }) => s.episode_count > 0)
        .map((s: Record<string, unknown>) => ({
          seasonNumber: s.season_number as number,
          name: s.name as string,
          episodeCount: s.episode_count as number,
          posterUrl: s.poster_path ? `${IMG}/w185${s.poster_path}` : "",
          year: typeof s.air_date === "string" ? s.air_date.slice(0, 4) : "",
        })),
    };
  }
}

export async function fetchSeason(
  seriesId: number,
  seasonNumber: number,
): Promise<TmdbEpisode[]> {
  const key = process.env.TMDB_API_KEY;
  if (!key) return [];
  try {
    const res = await fetch(
      `${BASE}/tv/${seriesId}/season/${seasonNumber}?api_key=${key}&language=fr-FR`,
      { next: { revalidate: 3600 } },
    );
    if (!res.ok) return [];
    const data = await res.json();
    return ((data.episodes ?? []) as Record<string, unknown>[]).map((e) => ({
      episodeNumber: e.episode_number as number,
      name: (e.name as string) ?? "",
      overview: (e.overview as string) ?? "",
      stillUrl: e.still_path ? `${IMG}/w300${e.still_path}` : "",
      airDate: (e.air_date as string) ?? "",
      runtime: (e.runtime as number) ?? null,
      voteAverage: e.vote_average ? Math.round((e.vote_average as number) * 10) / 10 : 0,
    }));
  } catch {
    return [];
  }
}

export async function fetchSeriesLogo(id: number): Promise<string | null> {
  const key = process.env.TMDB_API_KEY;
  if (!key) return null;
  try {
    const res = await fetch(
      `${BASE}/tv/${id}/images?api_key=${key}&include_image_language=fr,en,null`,
      { next: { revalidate: 86400 } },
    );
    if (!res.ok) return null;
    const data = await res.json();
    const logos = (data.logos ?? []) as TmdbLogo[];
    const usable = logos.filter(
      (l) => l.aspect_ratio >= 1.2 && l.file_path.toLowerCase().endsWith(".png"),
    );
    if (usable.length === 0) return null;
    const bestFor = (lang: string | null) =>
      usable
        .filter((l) => l.iso_639_1 === lang)
        .sort((a, b) => b.vote_average - a.vote_average)[0];
    const best = bestFor("fr") ?? bestFor("en") ?? bestFor(null) ?? usable[0];
    return best ? `${IMG}/w500${best.file_path}` : null;
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

export type TmdbDiscoverSeries = {
  id: number;
  name: string;
  year: string;
  posterUrl: string;
  voteAverage: number;
};

export async function fetchDiscoverSeries(
  category: string,
  genreId: number | null,
  page: number = 1,
  anime: boolean = false,
): Promise<TmdbDiscoverSeries[]> {
  const key = process.env.TMDB_API_KEY;
  if (!key) return [];
  try {
    const today = new Date().toISOString().split("T")[0];
    const past60 = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

    let extra = "";
    if (category === "top_rated") {
      extra = "&sort_by=vote_average.desc&vote_count.gte=200";
    } else if (category === "on_the_air") {
      extra = `&sort_by=popularity.desc&air_date.gte=${past60}&air_date.lte=${today}`;
    } else {
      extra = "&sort_by=popularity.desc";
    }

    // Genres : l'anime = Animation (16) + langue japonaise
    const genres: string[] = [];
    if (anime) genres.push("16");
    if (genreId) genres.push(String(genreId));
    if (genres.length) extra += `&with_genres=${genres.join(",")}`;
    if (anime) extra += "&with_original_language=ja";

    const url = `${BASE}/discover/tv?api_key=${key}&language=fr-FR&page=${page}${extra}`;
    const res = await fetch(url, { next: { revalidate: 3600 } });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.results ?? []).map((m: Record<string, unknown>) => ({
      id: m.id,
      name: m.name,
      year: typeof m.first_air_date === "string" ? m.first_air_date.slice(0, 4) : "",
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
    // Deux pages (TMDB en renvoie 20 par page) : la fiche n'en affiche que 8
    // au départ, mais le bouton « de plus » doit avoir de quoi dérouler.
    const [p1, p2] = await Promise.all(
      [1, 2].map((page) =>
        fetch(
          `${BASE}/movie/${id}/recommendations?api_key=${key}&language=fr-FR&page=${page}`,
          { next: { revalidate: 86400 } },
        ).then((r) => (r.ok ? r.json() : { results: [] }))
         .catch(() => ({ results: [] })),
      ),
    );

    const seen = new Set<number>();
    return [...(p1.results ?? []), ...(p2.results ?? [])]
      .filter((m: Record<string, unknown>) => {
        const filmId = m.id as number;
        if (!m.poster_path || seen.has(filmId)) return false;
        seen.add(filmId);
        return true;
      })
      .map((m: Record<string, unknown>) => ({
        id: m.id as number,
        title: (m.title as string) ?? "",
        posterUrl: m.poster_path ? `${IMG}/w342${m.poster_path}` : "",
        year: typeof m.release_date === "string" ? m.release_date.slice(0, 4) : "",
        genres: ((m.genre_ids as number[]) ?? []).slice(0, 2).map((gid) => GENRES[gid]).filter(Boolean),
        voteAverage: m.vote_average ? Math.round((m.vote_average as number) * 10) / 10 : 0,
      }));
  } catch {
    return [];
  }
}

/**
 * Tous les films d'une saga TMDB (« collection »), triés par date de sortie.
 * `/movie/{id}/recommendations` n'en renvoie qu'une partie : sur Star Wars par
 * exemple, plusieurs épisodes manquaient à l'appel.
 */
export async function fetchFilmCollection(collectionId: number): Promise<TmdbFilmCard[]> {
  const key = process.env.TMDB_API_KEY;
  if (!key) return [];
  try {
    const res = await fetch(
      `${BASE}/collection/${collectionId}?api_key=${key}&language=fr-FR`,
      { next: { revalidate: 86400 } }
    );
    if (!res.ok) return [];
    const data = await res.json();
    // Ordre chronologique de sortie ; les films sans date passent à la fin.
    const parts = ((data.parts ?? []) as Record<string, unknown>[]).slice().sort((a, b) => {
      const da = (a.release_date as string) || "9999";
      const db = (b.release_date as string) || "9999";
      return da.localeCompare(db);
    });

    return parts.map((m) => ({
      id: m.id as number,
      title: (m.title as string) ?? "",
      posterUrl: m.poster_path ? `${IMG}/w342${m.poster_path}` : "",
      year: typeof m.release_date === "string" ? m.release_date.slice(0, 4) : "",
      genres: ((m.genre_ids as number[]) ?? []).slice(0, 2).map((gid) => GENRES[gid]).filter(Boolean),
      voteAverage: Math.round(((m.vote_average as number) ?? 0) * 10) / 10,
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

// Postes d'équipe qui définissent vraiment une filmographie, du plus
// significatif au moins. Un même film peut cumuler plusieurs postes
// (Nolan est réalisateur ET scénariste) : on retient le plus haut.
const CREW_JOBS: Record<string, { label: string; rank: number; dept: CreditDepartment }> = {
  Director: { label: "Réalisateur", rank: 0, dept: "directing" },
  Writer: { label: "Scénariste", rank: 1, dept: "writing" },
  Screenplay: { label: "Scénariste", rank: 2, dept: "writing" },
  Story: { label: "Histoire", rank: 3, dept: "writing" },
  // rang 4 : réservé au rôle d'acteur (ACTING_RANK)
  Producer: { label: "Producteur", rank: 5, dept: "production" },
  "Executive Producer": { label: "Producteur exécutif", rank: 6, dept: "production" },
  "Original Music Composer": { label: "Musique", rank: 7, dept: "other" },
  "Director of Photography": { label: "Chef opérateur", rank: 8, dept: "other" },
  Editor: { label: "Montage", rank: 9, dept: "other" },
};

/**
 * Apparitions « dans son propre rôle » : ce sont les making-of, documentaires
 * et émissions qui polluaient les fiches. Chez Nolan, 30 de ses 31 crédits
 * d'acteur sont de ce type. On les écarte — sans toucher aux vrais rôles,
 * Tarantino jouant réellement dans une trentaine de films.
 */
const SELF_ROLE = /\b(self|himself|herself|themselves|lui-m[êe]me|elle-m[êe]me)\b/i;

// Le jeu d'acteur passe après la réalisation et le scénario, mais AVANT la
// production : DiCaprio est producteur du Loup de Wall Street, on veut
// néanmoins y lire « Jordan Belfort ». À l'inverse Eastwood, réalisateur et
// acteur de Gran Torino, est bien annoncé comme réalisateur.
const ACTING_RANK = 4;

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

    // On ne lisait que `cast` : pour un réalisateur comme Nolan, ses crédits
    // d'acteur ne sont que des apparitions « Self » dans des documentaires,
    // et ses vrais films (Inception, Interstellar…) sont dans `crew`.
    // On fusionne les deux et on dédoublonne par film.
    const byFilm = new Map<
      number,
      { raw: Record<string, unknown>; role: string; rank: number; dept: CreditDepartment }
    >();

    for (const m of (data.cast ?? []) as Record<string, unknown>[]) {
      if (!m.poster_path) continue;
      const character = (m.character as string) ?? "";
      if (SELF_ROLE.test(character)) continue;
      byFilm.set(m.id as number, {
        raw: m,
        role: character,
        rank: ACTING_RANK,
        dept: "acting",
      });
    }

    for (const m of (data.crew ?? []) as Record<string, unknown>[]) {
      if (!m.poster_path) continue;
      // Postes techniques secondaires (assistants, cascades…) : ignorés, ils
      // noieraient la filmographie.
      const job = CREW_JOBS[m.job as string];
      if (!job) continue;
      const existing = byFilm.get(m.id as number);
      if (!existing || job.rank < existing.rank) {
        byFilm.set(m.id as number, { raw: m, role: job.label, rank: job.rank, dept: job.dept });
      }
    }

    return [...byFilm.values()]
      .sort((a, b) => ((b.raw.vote_count as number) ?? 0) - ((a.raw.vote_count as number) ?? 0))
      .map(({ raw: m, role, dept }) => ({
        id: m.id as number,
        title: (m.title as string) ?? "",
        character: role,
        posterUrl: m.poster_path ? `${IMG}/w342${m.poster_path}` : "",
        year: typeof m.release_date === "string" ? m.release_date.slice(0, 4) : "",
        voteAverage: m.vote_average ? Math.round((m.vote_average as number) * 10) / 10 : 0,
        voteCount: (m.vote_count as number) ?? 0,
        popularity: typeof m.popularity === "number" ? Math.round(m.popularity * 10) / 10 : 0,
        department: dept,
      }));
  } catch {
    return [];
  }
}

const RANK_PAGES = 250; // top 5000 actors

// Liste ordonnée des IDs d'acteurs populaires (par popularité TMDB).
// 250 requêtes TMDB, mais mises en cache et reconstruites au plus une fois par 24 h
// — au lieu d'une fois par affichage de page acteur.
const getPopularPersonIds = unstable_cache(
  async (): Promise<number[]> => {
    const key = process.env.TMDB_API_KEY;
    if (!key) return [];
    const pageNums = Array.from({ length: RANK_PAGES }, (_, i) => i + 1);
    const pages = await Promise.all(
      pageNums.map((page) =>
        fetch(`${BASE}/person/popular?api_key=${key}&page=${page}`, { next: { revalidate: 86400 } })
          .then((r) => (r.ok ? r.json() : { results: [] })),
      ),
    );
    return pages.flatMap((p) =>
      ((p.results ?? []) as { id: number }[]).map((x) => x.id),
    );
  },
  ["popular-person-ids"],
  { revalidate: 86400 },
);

export async function fetchPersonPopularRank(id: number): Promise<number | null> {
  try {
    const ids = await getPopularPersonIds();
    const idx = ids.indexOf(id);
    return idx !== -1 ? idx + 1 : null;
  } catch {
    return null;
  }
}
