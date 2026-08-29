import { unstable_cache } from "next/cache";

const BASE = "https://api.themoviedb.org/3";
export const IMG = "https://image.tmdb.org/t/p";

/**
 * Taille des images d'arrière-plan.
 *
 * `original` sert des JPEG de 2000 à 3800px de large, soit 1 à 3 Mo pièce. Le
 * carrousel d'accueil les passait à l'optimiseur Next, qui doit les décoder en
 * bitmap brut avant de les réencoder : un 3840×2160 pèse 33 Mo en mémoire, et
 * l'accueil en enchaîne un par film affiché. Sur les fiches film/série, où le
 * backdrop est posé en `background-image`, c'est le navigateur du visiteur qui
 * encaissait ces mégaoctets.
 *
 * `w1280` couvre la quasi-totalité des écrans, et l'image est de toute façon
 * soit floutée (fiches) soit recadrée en `cover` (carrousel) : la différence
 * est invisible, le poids divisé par cinq à dix.
 */
const BACKDROP_SIZE = "w1280";

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
  productionCompanies: TmdbCompany[];
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

/** Société de production — cliquable vers sa filmographie. */
export type TmdbCompany = {
  id: number;
  name: string;
  /** Logo sur fond transparent ; vide si TMDB n'en a pas. */
  logoUrl: string;
};

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

// Les séries ont leur propre nomenclature chez TMDB : « Action & Adventure »
// remplace Action et Aventure, « Sci-Fi & Fantasy » fusionne SF et Fantastique.
// Utiliser GENRES sur une série donnerait des filtres silencieusement vides.
export const TV_GENRES: Record<number, string> = {
  10759: "Action & Adventure", 16: "Animation", 35: "Comédie", 80: "Crime",
  99: "Documentaire", 18: "Drame", 10751: "Famille", 10762: "Enfants",
  9648: "Mystère", 10763: "Actualités", 10764: "Réalité", 10765: "Sci-Fi & Fantasy",
  10766: "Feuilleton", 10767: "Talk", 10768: "Guerre & Politique", 37: "Western",
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
      backdropUrl: m.backdrop_path ? `${IMG}/${BACKDROP_SIZE}${m.backdrop_path}` : "",
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
        backdropUrl: m.backdrop_path ? `${IMG}/${BACKDROP_SIZE}${m.backdrop_path}` : "",
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
      backdropUrl: m.backdrop_path ? `${IMG}/${BACKDROP_SIZE}${m.backdrop_path}` : "",
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
        .slice(0, 6)
        .map((c: { id: number; name: string; logo_path: string | null }) => ({
          id: c.id,
          name: c.name,
          logoUrl: c.logo_path ? `${IMG}/w154${c.logo_path}` : "",
        })),
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
  /** Moyenne TMDB de la saison — présente dès la liste des saisons de /tv/{id}. */
  voteAverage: number;
};

/** Chaîne ou plateforme de diffusion, avec son logo. */
export type TmdbNetwork = { id: number; name: string; logoUrl: string };

/** Épisode annoncé (le prochain à venir, ou le dernier diffusé). */
export type TmdbEpisodeStub = {
  name: string;
  airDate: string;
  seasonNumber: number;
  episodeNumber: number;
};

export type TmdbSeriesDetail = {
  id: number;
  name: string;
  originalName: string;
  tagline: string;
  overview: string;
  posterUrl: string;
  backdropUrl: string;
  year: string;
  firstAirDate: string;
  lastAirDate: string;
  status: string;
  /** « Scripted », « Miniseries », « Reality »… */
  type: string;
  inProduction: boolean;
  numberOfSeasons: number;
  numberOfEpisodes: number;
  episodeRunTime: number | null;
  voteAverage: number;
  voteCount: number;
  popularity: number;
  genres: string[];
  networks: TmdbNetwork[];
  createdBy: TmdbCrewMember[];
  originalLanguage: string;
  spokenLanguages: string[];
  productionCountries: string[];
  productionCompanies: TmdbCompany[];
  homepage: string;
  nextEpisode: TmdbEpisodeStub | null;
  lastEpisode: TmdbEpisodeStub | null;
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
  /** Nombre de votes TMDB : une note à 10/10 sur 3 votes ne vaut pas un 8,5 sur 500. */
  voteCount: number;
  /** « standard », « finale », « mid_season »… — sert à repérer les fins de saison. */
  episodeType: string;
  /** Réalisateur(s) de l'épisode. */
  directors: TmdbCrewMember[];
};

/** Détail d'une saison : les épisodes + la note TMDB de la saison entière. */
export type TmdbSeason = {
  episodes: TmdbEpisode[];
  /** Moyenne TMDB de la saison, à confronter à la note personnelle. */
  voteAverage: number;
  overview: string;
  airDate: string;
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
  return m ? mapSeriesDetail(m) : null;
}

/** Conversion du payload brut /tv/{id}. Partagée avec fetchSeriesBundle. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- payload TMDB brut
function mapSeriesDetail(m: any): TmdbSeriesDetail {
  {
    const runTimes: number[] = m.episode_run_time ?? [];

    const toStub = (e: Record<string, unknown> | null): TmdbEpisodeStub | null =>
      e
        ? {
            name: (e.name as string) ?? "",
            airDate: (e.air_date as string) ?? "",
            seasonNumber: (e.season_number as number) ?? 0,
            episodeNumber: (e.episode_number as number) ?? 0,
          }
        : null;

    return {
      id: m.id,
      name: m.name ?? "",
      originalName: m.original_name ?? "",
      tagline: m.tagline ?? "",
      overview: m.overview ?? "",
      posterUrl: m.poster_path ? `${IMG}/w500${m.poster_path}` : "",
      backdropUrl: m.backdrop_path ? `${IMG}/${BACKDROP_SIZE}${m.backdrop_path}` : "",
      year: m.first_air_date?.slice(0, 4) ?? "",
      firstAirDate: m.first_air_date ?? "",
      lastAirDate: m.last_air_date ?? "",
      status: m.status ?? "",
      type: m.type ?? "",
      inProduction: Boolean(m.in_production),
      numberOfSeasons: m.number_of_seasons ?? 0,
      numberOfEpisodes: m.number_of_episodes ?? 0,
      episodeRunTime: runTimes.length > 0 ? runTimes[0] : null,
      voteAverage: Math.round((m.vote_average ?? 0) * 10) / 10,
      voteCount: m.vote_count ?? 0,
      popularity: Math.round((m.popularity ?? 0) * 10) / 10,
      genres: (m.genres ?? []).map((g: { name: string }) => g.name),
      networks: (m.networks ?? [])
        .slice(0, 5)
        .map((n: { id: number; name: string; logo_path: string | null }) => ({
          id: n.id,
          name: n.name,
          logoUrl: n.logo_path ? `${IMG}/w154${n.logo_path}` : "",
        })),
      createdBy: (m.created_by ?? [])
        .slice(0, 4)
        .map((c: { id: number; name: string }) => ({ id: c.id, name: c.name })),
      productionCompanies: (m.production_companies ?? [])
        .slice(0, 6)
        .map((c: { id: number; name: string; logo_path: string | null }) => ({
          id: c.id,
          name: c.name,
          logoUrl: c.logo_path ? `${IMG}/w154${c.logo_path}` : "",
        })),
      homepage: m.homepage ?? "",
      nextEpisode: toStub(m.next_episode_to_air ?? null),
      lastEpisode: toStub(m.last_episode_to_air ?? null),
      originalLanguage: m.original_language ?? "",
      spokenLanguages: (m.spoken_languages ?? []).map((l: { name: string }) => l.name),
      productionCountries: (m.production_countries ?? []).map((c: { name: string }) => c.name),
      // on garde les saisons ayant au moins un épisode (saison 0 = spéciaux inclus)
      seasons: (m.seasons ?? [])
        .filter((s: { episode_count: number }) => s.episode_count > 0)
        .map((s: Record<string, unknown>) => ({
          seasonNumber: s.season_number as number,
          name: s.name as string,
          episodeCount: s.episode_count as number,
          posterUrl: s.poster_path ? `${IMG}/w185${s.poster_path}` : "",
          year: typeof s.air_date === "string" ? s.air_date.slice(0, 4) : "",
          voteAverage: s.vote_average ? Math.round((s.vote_average as number) * 10) / 10 : 0,
        })),
    };
  }
}

const EMPTY_SEASON: TmdbSeason = { episodes: [], voteAverage: 0, overview: "", airDate: "" };

/**
 * Détail d'une saison.
 *
 * La réponse TMDB contient déjà la note et le nombre de votes de chaque
 * épisode, ainsi que son équipe — on ne les lisait pas. Les exploiter ne coûte
 * donc aucun appel supplémentaire : c'est la même requête qu'avant.
 */
export async function fetchSeason(
  seriesId: number,
  seasonNumber: number,
): Promise<TmdbSeason> {
  const key = process.env.TMDB_API_KEY;
  if (!key) return EMPTY_SEASON;
  try {
    const res = await fetch(
      `${BASE}/tv/${seriesId}/season/${seasonNumber}?api_key=${key}&language=fr-FR`,
      { next: { revalidate: 3600 } },
    );
    if (!res.ok) return EMPTY_SEASON;
    const data = await res.json();

    const episodes: TmdbEpisode[] = ((data.episodes ?? []) as Record<string, unknown>[]).map((e) => {
      const crew = (e.crew ?? []) as Array<{ id: number; name: string; job: string }>;
      return {
        episodeNumber: e.episode_number as number,
        name: (e.name as string) ?? "",
        overview: (e.overview as string) ?? "",
        stillUrl: e.still_path ? `${IMG}/w300${e.still_path}` : "",
        airDate: (e.air_date as string) ?? "",
        runtime: (e.runtime as number) ?? null,
        voteAverage: e.vote_average ? Math.round((e.vote_average as number) * 10) / 10 : 0,
        voteCount: (e.vote_count as number) ?? 0,
        episodeType: (e.episode_type as string) ?? "standard",
        // Deux réalisateurs au plus : au-delà, la ligne d'épisode déborde.
        directors: crew
          .filter((c) => c.job === "Director")
          .slice(0, 2)
          .map((c) => ({ id: c.id, name: c.name })),
      };
    });

    return {
      episodes,
      voteAverage: data.vote_average ? Math.round((data.vote_average as number) * 10) / 10 : 0,
      overview: (data.overview as string) ?? "",
      airDate: (data.air_date as string) ?? "",
    };
  } catch {
    return EMPTY_SEASON;
  }
}

/** Conversion d'un payload aggregate_credits. Partagée avec fetchSeriesBundle. */
function mapAggregateCredits(raw: unknown): TmdbCredits {
  const data = (raw ?? {}) as { cast?: unknown; crew?: unknown };
  {
    const cast: TmdbCastMember[] = ((data.cast ?? []) as Record<string, unknown>[])
      .sort((a, b) => ((b.total_episode_count as number) ?? 0) - ((a.total_episode_count as number) ?? 0))
      .slice(0, 20)
      .map((c) => {
        // `roles` liste chaque personnage joué ; on retient le principal.
        const roles = (c.roles ?? []) as Array<{ character: string }>;
        return {
          id: c.id as number,
          name: (c.name as string) ?? "",
          character: roles[0]?.character ?? "",
          profileUrl: c.profile_path ? `${IMG}/w185${c.profile_path}` : "",
        };
      });

    // Côté équipe, on garde réalisation et écriture, triées par implication.
    const crew = (data.crew ?? []) as Record<string, unknown>[];
    const pick = (department: string) =>
      crew
        .filter((c) => c.department === department)
        .sort((a, b) => ((b.total_episode_count as number) ?? 0) - ((a.total_episode_count as number) ?? 0))
        .slice(0, 4)
        .map((c) => ({ id: c.id as number, name: (c.name as string) ?? "" }));

    return { cast, directors: pick("Directing"), writers: pick("Writing") };
  }
}

/**
 * Tout ce dont la fiche série a besoin, en UN SEUL appel réseau.
 *
 * La page enchaînait six requêtes TMDB indépendantes (détail, logo, casting,
 * recommandations, plateformes, identifiants externes). `append_to_response`
 * accepte jusqu'à 20 sous-ressources dans la même requête — vérifié avec les
 * huit ci-dessous.
 */
export type SeriesBundle = {
  detail: TmdbSeriesDetail;
  credits: TmdbCredits;
  providers: WatchProviders;
  externalIds: TmdbExternalIds;
  keywords: string[];
  video: TmdbVideo | null;
  /** Classification d'âge française (ou américaine en repli). */
  certification: string | null;
  logoUrl: string | null;
  similar: TmdbFilmCard[];
};

const SERIES_APPEND = [
  "aggregate_credits",
  "watch/providers",
  "external_ids",
  "keywords",
  "videos",
  "content_ratings",
  "recommendations",
  "images",
].join(",");

export async function fetchSeriesBundle(id: number): Promise<SeriesBundle | null> {
  const key = process.env.TMDB_API_KEY;
  if (!key) return null;

  // Même distinction 404 / panne passagère que fetchTmdbDetail : un hoquet de
  // TMDB ne doit pas produire une page « série introuvable ».
  const url =
    `${BASE}/tv/${id}?api_key=${key}&language=fr-FR` +
    `&append_to_response=${SERIES_APPEND}&include_image_language=fr,en,null`;

  let raw: Record<string, unknown> | null = null;
  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(url, { next: { revalidate: 3600 } });
      if (res.status === 404) return null;
      if (res.ok) {
        raw = await res.json();
        break;
      }
      lastError = new Error(`TMDB a répondu ${res.status} sur /tv/${id}`);
    } catch (err) {
      lastError = err;
    }
  }
  if (!raw) {
    throw lastError instanceof Error ? lastError : new Error(`TMDB injoignable sur /tv/${id}`);
  }

  const providersRaw = (raw["watch/providers"] as { results?: Record<string, unknown> })?.results;
  const local = providersRaw?.[WATCH_REGION] as Record<string, unknown> | undefined;

  const recommendations =
    (raw.recommendations as { results?: Record<string, unknown>[] })?.results ?? [];

  return {
    detail: mapSeriesDetail(raw),
    credits: mapAggregateCredits(raw.aggregate_credits),
    providers: local
      ? {
          flatrate: mapProviders(local.flatrate),
          rent: mapProviders(local.rent),
          buy: mapProviders(local.buy),
          link: (local.link as string) ?? "",
        }
      : EMPTY_PROVIDERS,
    externalIds: mapExternalIds(raw.external_ids as Record<string, unknown>),
    keywords: (((raw.keywords as { results?: Array<{ name: string }> })?.results) ?? []).map(
      (k) => k.name,
    ),
    video: pickBestVideo((raw.videos as { results?: unknown })?.results),
    certification: pickCertification("tv", raw.content_ratings),
    logoUrl: pickBestLogo((raw.images as { logos?: TmdbLogo[] })?.logos),
    similar: recommendations
      .filter((s) => s.poster_path)
      .map((s) => ({
        // TmdbFilmCard est réutilisé pour partager la grille avec les films :
        // `title` porte donc le nom de la série.
        id: s.id as number,
        title: (s.name as string) ?? "",
        posterUrl: `${IMG}/w342${s.poster_path}`,
        year: typeof s.first_air_date === "string" ? s.first_air_date.slice(0, 4) : "",
        genres: ((s.genre_ids as number[]) ?? []).slice(0, 2).map((g) => TV_GENRES[g]).filter(Boolean),
        voteAverage: s.vote_average ? Math.round((s.vote_average as number) * 10) / 10 : 0,
      })),
  };
}

/**
 * Meilleur logo exploitable parmi ceux renvoyés par TMDB.
 *
 * On écarte les logos hauts et étroits (illisibles dans un bandeau) et tout ce
 * qui n'est pas PNG (fond transparent). Priorité : français, puis anglais,
 * puis sans langue ; à égalité, le mieux noté.
 */
function pickBestLogo(logos: TmdbLogo[] | undefined): string | null {
  const usable = (logos ?? []).filter(
    (l) => l.aspect_ratio >= 1.2 && l.file_path.toLowerCase().endsWith(".png"),
  );
  if (usable.length === 0) return null;

  const bestFor = (lang: string | null) =>
    usable
      .filter((l) => l.iso_639_1 === lang)
      .sort((a, b) => b.vote_average - a.vote_average)[0];

  const best = bestFor("fr") ?? bestFor("en") ?? bestFor(null) ?? usable[0];
  return best ? `${IMG}/w500${best.file_path}` : null;
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
    return pickBestLogo((await res.json()).logos);
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

// ——————————————————————————————————————————————————————————————
//  « Mieux notés » — classement bayésien
// ——————————————————————————————————————————————————————————————
//
// Trier bêtement sur `vote_average.desc` fait remonter n'importe quel film
// confidentiel noté 8.9 par 350 personnes devant Le Parrain. Relever le seuil
// de votes (`vote_count.gte`) règle ce cas mais en crée un autre : les films
// reconnus mais peu vus disparaissent complètement du classement.
//
// On applique donc la moyenne pondérée utilisée par le Top 250 d'IMDb :
//
//     WR = (v / (v + m)) × R  +  (m / (v + m)) × C
//
// où R = note du titre, v = nombre de votes, C = moyenne globale du catalogue
// et m = « masse » de votes a priori. Un titre peu voté est tiré vers C ; plus
// il accumule de votes, plus sa propre note pèse. Le seuil n'est plus un
// couperet mais une pente : un film à 800 votes reste classable, simplement il
// lui faut une note nettement supérieure pour devancer un classique.
const BAYES_C = 6.7; // moyenne observée sur le catalogue TMDB
const BAYES_M_MOVIE = 3000;
const BAYES_M_TV = 900; // les séries récoltent bien moins de votes que les films

type RankedRaw = {
  raw: Record<string, unknown>;
  score: number;
};

function bayesianScore(raw: Record<string, unknown>, m: number): number {
  const R = (raw.vote_average as number) ?? 0;
  const v = (raw.vote_count as number) ?? 0;
  return (v / (v + m)) * R + (m / (v + m)) * BAYES_C;
}

/**
 * Note pondérée d'un titre, sur 10 — la même que celle du classement
 * « Mieux notés », exposée pour que les recommandations s'appuient dessus.
 *
 * Indispensable pour juger la qualité : la note brute récompense les titres
 * obscurs à forte moyenne. Demon Slayer – Sibling's Bond affiche 7,9 sur 257
 * votes (donc WR 6,79) là où Oppenheimer affiche 8,0 sur 12 282 (WR 7,76) :
 * classer sur la note brute mettait le premier devant.
 */
export function weightedRating(
  voteAverage: number,
  voteCount: number,
  media: "movie" | "tv" = "movie",
): number {
  const m = media === "movie" ? BAYES_M_MOVIE : BAYES_M_TV;
  return (voteCount / (voteCount + m)) * voteAverage + (m / (voteCount + m)) * BAYES_C;
}

/**
 * Mots-clés TMDB qui marquent un film de compilation — un montage d'épisodes
 * de série déjà diffusés. Ils n'ont aucun intérêt en recommandation : on
 * propose la « saison 1 remontée » de quelque chose que la personne connaît
 * déjà, ou pire, un résumé qui divulgâche la série.
 */
export const COMPILATION_KEYWORDS = [
  12197, // compilation
  194008, // edited from tv series
  274909, // recap
];

/**
 * Construit un vivier de candidats puis le reclasse au score bayésien.
 *
 * TMDB ne sait pas trier ainsi : on constitue le vivier en croisant trois
 * angles complémentaires, puisqu'aucun tri TMDB seul ne contient l'ensemble
 * des bons candidats :
 *   1. les plus votés            → les classiques massivement vus
 *   2. les mieux notés, très soutenus → le haut du panier incontesté
 *   3. les mieux notés, seuil bas → les titres acclamés mais confidentiels
 * Le score départage ensuite tout le monde sur un pied d'égalité.
 */
const POOL_PAGES = 5; // 20 titres par page et par source

async function fetchRankedPool(
  media: "movie" | "tv",
  genreId: number | null,
  extraFilter: string,
): Promise<Record<string, unknown>[]> {
  const key = process.env.TMDB_API_KEY;
  if (!key) return [];

  const m = media === "movie" ? BAYES_M_MOVIE : BAYES_M_TV;
  const strongVotes = media === "movie" ? 2000 : 600;
  const weakVotes = media === "movie" ? 300 : 100;

  const sources = [
    `&sort_by=vote_count.desc`,
    `&sort_by=vote_average.desc&vote_count.gte=${strongVotes}`,
    `&sort_by=vote_average.desc&vote_count.gte=${weakVotes}`,
  ];

  const genreFilter = genreId ? `&with_genres=${genreId}` : "";

  const requests = sources.flatMap((source) =>
    Array.from({ length: POOL_PAGES }, (_, i) =>
      fetch(
        `${BASE}/discover/${media}?api_key=${key}&language=fr-FR&page=${i + 1}${source}${genreFilter}${extraFilter}`,
        { next: { revalidate: 86400 } },
      )
        .then((r) => (r.ok ? r.json() : { results: [] }))
        .catch(() => ({ results: [] })),
    ),
  );

  const pages = await Promise.all(requests);

  // Dédoublonnage : les trois sources se recoupent largement en haut de classement
  const byId = new Map<number, Record<string, unknown>>();
  for (const page of pages) {
    for (const item of (page.results ?? []) as Record<string, unknown>[]) {
      if (!item.poster_path) continue;
      byId.set(item.id as number, item);
    }
  }

  const ranked: RankedRaw[] = [...byId.values()].map((raw) => ({
    raw,
    score: bayesianScore(raw, m),
  }));

  return ranked.sort((a, b) => b.score - a.score).map((r) => r.raw);
}

// Le vivier coûte 15 appels TMDB : on le garde 24 h, par média et par genre.
const getRankedPool = unstable_cache(
  fetchRankedPool,
  ["tmdb-ranked-pool"],
  { revalidate: 86400 },
);

/** Filtres communs aux pages « Découvrir » films et séries. */
export type DiscoverOptions = {
  genreId?: number | null;
  page?: number;
  /** Année de sortie minimale, incluse (ex. « 1990 »). */
  minYear?: string;
  /** Année de sortie maximale, incluse. */
  maxYear?: string;
  /** Note TMDB minimale, sur 10. */
  minRating?: number;
  /** Séries uniquement : restreint aux animes (animation japonaise). */
  anime?: boolean;
  /**
   * Identifiants de plateformes JustWatch (8 = Netflix, 119 = Prime…).
   * Plusieurs valeurs = OU : « ce que je peux voir avec mes abonnements ».
   */
  providers?: number[];
};

/** Les plateformes se filtrent toujours pour une région donnée. */
export const WATCH_REGION = "FR";

/**
 * Plateformes proposées dans les filtres.
 *
 * TMDB en renvoie plus de 100 pour la France, dont une longue traîne de
 * micro-services : les lister toutes rendrait le filtre inutilisable. On garde
 * celles qui ont un vrai catalogue, dans l'ordre d'usage réel.
 */
// Identifiants vérifiés le 21/08/2026 contre /watch/providers/{movie,tv}
// pour watch_region=FR. Ne pas les deviner : plusieurs noms évidents pointent
// ailleurs (415 est Animation Digital Network et non OCS, 234 est Arte et non
// Paramount+). Les libellés sont ceux de TMDB, raccourcis quand ils sont longs.
export const WATCH_PROVIDERS: Array<{ id: number; name: string }> = [
  { id: 8, name: "Netflix" },
  { id: 119, name: "Prime Video" },
  { id: 337, name: "Disney+" },
  { id: 1899, name: "HBO Max" },
  { id: 350, name: "Apple TV+" },
  { id: 381, name: "Canal+" },
  { id: 531, name: "Paramount+" },
  { id: 283, name: "Crunchyroll" },
  { id: 234, name: "Arte" },
  { id: 11, name: "MUBI" },
  { id: 223, name: "Hayu" },
  { id: 35, name: "Rakuten TV" },
];

const DISCOVER_PAGE_SIZE = 20; // taille d'une page TMDB, que l'on reproduit sur le vivier

/** Bornes d'années, note plancher et plateformes — communs aux deux médias. */
function commonFilters(
  { minYear, maxYear, minRating, providers }: DiscoverOptions,
  dateField: "primary_release_date" | "first_air_date",
): string {
  let f = "";
  if (minYear) f += `&${dateField}.gte=${minYear}-01-01`;
  if (maxYear) f += `&${dateField}.lte=${maxYear}-12-31`;
  // Note et plateformes sont déjà gérées par nonDateFilters : ne pas les
  // répéter ici, TMDB recevrait deux fois le même paramètre.
  return f + nonDateFilters({ minRating, providers });
}

/**
 * Filtres qui ne touchent pas aux dates.
 *
 * « En salle », « À venir » et « En diffusion » imposent déjà leur propre
 * fenêtre de dates : leur superposer les bornes de l'utilisateur donnerait un
 * résultat vide. Ils appliquent donc seulement ceux-là.
 */
function nonDateFilters({ minRating, providers }: DiscoverOptions): string {
  let f = "";
  if (minRating) f += `&vote_average.gte=${minRating}`;
  if (providers?.length) {
    // « | » = OU chez TMDB. `watch_region` est obligatoire : sans lui, le
    // filtre de plateforme est ignoré en silence.
    f += `&with_watch_providers=${providers.join("|")}&watch_region=${WATCH_REGION}`;
  }
  return f;
}

function mapDiscoverFilm(m: Record<string, unknown>): TmdbDiscoverFilm {
  return {
    id: m.id as number,
    title: (m.title as string) ?? "",
    year: typeof m.release_date === "string" ? m.release_date.slice(0, 4) : "",
    posterUrl: m.poster_path ? `${IMG}/w342${m.poster_path}` : "",
    voteAverage: m.vote_average ? Math.round((m.vote_average as number) * 10) / 10 : 0,
  };
}

export async function fetchDiscover(
  category: string,
  opts: DiscoverOptions = {},
): Promise<TmdbDiscoverFilm[]> {
  const key = process.env.TMDB_API_KEY;
  if (!key) return [];

  const { genreId = null, page = 1 } = opts;
  const filters = commonFilters(opts, "primary_release_date");

  try {
    // « Mieux notés » ne passe pas par un tri TMDB : on pagine le vivier reclassé.
    if (category === "top_rated") {
      const pool = await getRankedPool("movie", genreId, filters);
      return pool
        .slice((page - 1) * DISCOVER_PAGE_SIZE, page * DISCOVER_PAGE_SIZE)
        .map(mapDiscoverFilm);
    }

    const today = new Date().toISOString().split("T")[0];
    const past45 = new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
    const future90 = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

    let extra = "";
    if (category === "now_playing") {
      extra = `&sort_by=popularity.desc&primary_release_date.gte=${past45}&primary_release_date.lte=${today}`;
    } else if (category === "upcoming") {
      extra = `&sort_by=popularity.desc&primary_release_date.gte=${today}&primary_release_date.lte=${future90}`;
    } else {
      extra = "&sort_by=popularity.desc";
    }
    if (genreId) extra += `&with_genres=${genreId}`;
    // « En salle » et « À venir » définissent déjà leur fenêtre de dates :
    // y superposer les bornes de l'utilisateur donnerait un résultat vide.
    // On leur applique donc seulement les filtres hors dates.
    extra +=
      category === "now_playing" || category === "upcoming"
        ? nonDateFilters(opts)
        : filters;

    const url = `${BASE}/discover/movie?api_key=${key}&language=fr-FR&page=${page}${extra}`;
    const res = await fetch(url, { next: { revalidate: 3600 } });
    if (!res.ok) return [];
    const data = await res.json();
    return ((data.results ?? []) as Record<string, unknown>[]).map(mapDiscoverFilm);
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

function mapDiscoverSeries(m: Record<string, unknown>): TmdbDiscoverSeries {
  return {
    id: m.id as number,
    name: (m.name as string) ?? "",
    year: typeof m.first_air_date === "string" ? m.first_air_date.slice(0, 4) : "",
    posterUrl: m.poster_path ? `${IMG}/w342${m.poster_path}` : "",
    voteAverage: m.vote_average ? Math.round((m.vote_average as number) * 10) / 10 : 0,
  };
}

export async function fetchDiscoverSeries(
  category: string,
  opts: DiscoverOptions = {},
): Promise<TmdbDiscoverSeries[]> {
  const key = process.env.TMDB_API_KEY;
  if (!key) return [];

  const { genreId = null, page = 1, anime = false } = opts;
  const filters = commonFilters(opts, "first_air_date");
  // L'anime se définit par Animation (16) + langue japonaise : ce n'est pas un
  // genre TMDB, il se superpose donc au genre éventuellement choisi.
  const animeFilter = anime ? "&with_genres=16&with_original_language=ja" : "";

  try {
    if (category === "top_rated") {
      const pool = await getRankedPool("tv", genreId, filters + animeFilter);
      return pool
        .slice((page - 1) * DISCOVER_PAGE_SIZE, page * DISCOVER_PAGE_SIZE)
        .map(mapDiscoverSeries);
    }

    const today = new Date().toISOString().split("T")[0];
    const past60 = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
    const future90 = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

    let extra = "";
    if (category === "on_the_air") {
      extra = `&sort_by=popularity.desc&air_date.gte=${past60}&air_date.lte=${today}`;
    } else if (category === "upcoming") {
      // Séries dont la toute première diffusion est encore à venir
      extra = `&sort_by=popularity.desc&first_air_date.gte=${today}&first_air_date.lte=${future90}`;
    } else {
      extra = "&sort_by=popularity.desc";
    }

    const genres: string[] = [];
    if (anime) genres.push("16");
    if (genreId) genres.push(String(genreId));
    if (genres.length) extra += `&with_genres=${genres.join(",")}`;
    if (anime) extra += "&with_original_language=ja";

    // Comme pour les films : ne pas écraser la fenêtre de dates des catégories
    // qui en imposent déjà une.
    extra +=
      category === "on_the_air" || category === "upcoming"
        ? nonDateFilters(opts)
        : filters;

    const url = `${BASE}/discover/tv?api_key=${key}&language=fr-FR&page=${page}${extra}`;
    const res = await fetch(url, { next: { revalidate: 3600 } });
    if (!res.ok) return [];
    const data = await res.json();
    return ((data.results ?? []) as Record<string, unknown>[]).map(mapDiscoverSeries);
  } catch {
    return [];
  }
}

// ——————————————————————————————————————————————————————————————
//  Bandes-annonces
// ——————————————————————————————————————————————————————————————

export type TmdbVideo = {
  key: string;
  name: string;
  /** « Trailer », « Teaser »… */
  type: string;
  official: boolean;
  /** Langue de la vidéo, pour préférer le français. */
  lang: string;
};

/**
 * Meilleure bande-annonce disponible, ou `null`.
 *
 * TMDB renvoie pêle-mêle bandes-annonces, teasers, featurettes et extraits, de
 * toutes langues et de qualité inégale. On classe : bande-annonce avant
 * teaser, officielle avant amateur, française avant anglaise. On ne garde que
 * YouTube — c'est le seul hébergeur qu'on sait intégrer.
 */
export function pickBestVideo(raw: unknown): TmdbVideo | null {
  const list = (Array.isArray(raw) ? raw : []) as Record<string, unknown>[];

  const usable = list
    .filter((v) => v.site === "YouTube" && typeof v.key === "string")
    .map((v) => ({
      key: v.key as string,
      name: (v.name as string) ?? "",
      type: (v.type as string) ?? "",
      official: Boolean(v.official),
      lang: (v.iso_639_1 as string) ?? "",
    }))
    .filter((v) => v.type === "Trailer" || v.type === "Teaser");

  if (usable.length === 0) return null;

  const score = (v: TmdbVideo) =>
    (v.type === "Trailer" ? 4 : 0) +
    (v.official ? 2 : 0) +
    (v.lang === "fr" ? 1 : 0);

  return usable.sort((a, b) => score(b) - score(a))[0];
}

// ——————————————————————————————————————————————————————————————
//  Classification d'âge
// ——————————————————————————————————————————————————————————————

/**
 * Classification française, depuis `content_ratings` (séries) ou
 * `release_dates` (films) — deux formats différents pour la même information.
 * Repli sur les États-Unis quand la France n'est pas renseignée.
 */
export function pickCertification(
  media: "movie" | "tv",
  raw: unknown,
): string | null {
  const results = ((raw as { results?: unknown })?.results ?? []) as Record<string, unknown>[];
  if (results.length === 0) return null;

  const forCountry = (code: string): string | null => {
    const entry = results.find((r) => r.iso_3166_1 === code);
    if (!entry) return null;

    if (media === "tv") return (entry.rating as string) || null;

    // Films : la certification est nichée dans une liste de dates de sortie,
    // et plusieurs entrées peuvent être vides (ressorties, festivals).
    const dates = (entry.release_dates ?? []) as Array<{ certification?: string }>;
    return dates.map((d) => d.certification).find((c) => c && c.trim() !== "") ?? null;
  };

  return forCountry("FR") ?? forCountry("US");
}

/**
 * Bande-annonce + classification d'âge d'un film, en un seul appel.
 *
 * La fiche film garde ses requêtes séparées (elle a d'autres dépendances qui
 * ne se groupent pas), mais ces deux-là partagent le même endpoint via
 * `append_to_response` : autant ne pas payer deux allers-retours.
 */
export async function fetchFilmExtras(
  id: number,
): Promise<{ video: TmdbVideo | null; certification: string | null }> {
  const key = process.env.TMDB_API_KEY;
  if (!key) return { video: null, certification: null };
  try {
    const res = await fetch(
      `${BASE}/movie/${id}?api_key=${key}&language=fr-FR&append_to_response=videos,release_dates`,
      { next: { revalidate: 86400 } },
    );
    if (!res.ok) return { video: null, certification: null };
    const data = await res.json();
    return {
      video: pickBestVideo(data.videos?.results),
      certification: pickCertification("movie", data.release_dates),
    };
  } catch {
    return { video: null, certification: null };
  }
}

// ——————————————————————————————————————————————————————————————
//  Identifiants externes (IMDb, Wikidata, réseaux sociaux)
// ——————————————————————————————————————————————————————————————

export type TmdbExternalIds = {
  imdbId: string | null;
  /** Pont vers Wikidata, d'où l'on tire les distinctions. */
  wikidataId: string | null;
  instagramId: string | null;
  twitterId: string | null;
  facebookId: string | null;
};

const EMPTY_EXTERNAL_IDS: TmdbExternalIds = {
  imdbId: null,
  wikidataId: null,
  instagramId: null,
  twitterId: null,
  facebookId: null,
};

export function mapExternalIds(raw: Record<string, unknown> | null | undefined): TmdbExternalIds {
  if (!raw) return EMPTY_EXTERNAL_IDS;
  return {
    imdbId: (raw.imdb_id as string) || null,
    wikidataId: (raw.wikidata_id as string) || null,
    instagramId: (raw.instagram_id as string) || null,
    twitterId: (raw.twitter_id as string) || null,
    facebookId: (raw.facebook_id as string) || null,
  };
}

export async function fetchExternalIds(
  media: "movie" | "tv",
  id: number,
): Promise<TmdbExternalIds> {
  const key = process.env.TMDB_API_KEY;
  if (!key) return EMPTY_EXTERNAL_IDS;
  try {
    const res = await fetch(`${BASE}/${media}/${id}/external_ids?api_key=${key}`, {
      next: { revalidate: 86400 },
    });
    if (!res.ok) return EMPTY_EXTERNAL_IDS;
    return mapExternalIds(await res.json());
  } catch {
    return EMPTY_EXTERNAL_IDS;
  }
}

// ——————————————————————————————————————————————————————————————
//  Sociétés de production
// ——————————————————————————————————————————————————————————————

export type TmdbCompanyDetail = TmdbCompany & {
  description: string;
  headquarters: string;
  originCountry: string;
  homepage: string;
};

export async function fetchCompanyDetail(id: number): Promise<TmdbCompanyDetail | null> {
  const key = process.env.TMDB_API_KEY;
  if (!key) return null;
  try {
    // Pas de `language=fr-FR` : l'endpoint company ne traduit rien et le
    // paramètre fait seulement du bruit.
    const res = await fetch(`${BASE}/company/${id}?api_key=${key}`, {
      next: { revalidate: 86400 },
    });
    if (!res.ok) return null;
    const c = await res.json();
    return {
      id: c.id,
      name: c.name ?? "",
      logoUrl: c.logo_path ? `${IMG}/w154${c.logo_path}` : "",
      description: c.description ?? "",
      headquarters: c.headquarters ?? "",
      originCountry: c.origin_country ?? "",
      homepage: c.homepage ?? "",
    };
  } catch {
    return null;
  }
}

/** Critères de tri proposés sur une page société. */
export type CompanySort = "recent" | "oldest" | "popular" | "rating";

const COMPANY_SORT_SQL: Record<CompanySort, string> = {
  // Défaut : du plus récent au plus ancien — on veut voir ce que le studio
  // sort en ce moment, pas son film le plus populaire de tous les temps.
  recent: "primary_release_date.desc",
  oldest: "primary_release_date.asc",
  popular: "popularity.desc",
  rating: "vote_average.desc",
};

export type CompanyFilmsOptions = {
  page?: number;
  sort?: CompanySort;
  genreId?: number | null;
  minYear?: string;
  maxYear?: string;
  minRating?: number;
  /** « movie » (défaut) ou « tv » — un studio produit souvent les deux. */
  media?: "movie" | "tv";
};

/**
 * Catalogue d'une société de production, films ou séries.
 *
 * Les deux médias n'ont pas les mêmes noms de champs chez TMDB : le titre est
 * `title` ou `name`, la date `release_date` ou `first_air_date`, et le filtre
 * de date `primary_release_date` ou `first_air_date`. On renvoie un
 * TmdbFilmCard dans les deux cas pour partager la grille d'affichage.
 */
export async function fetchCompanyFilms(
  companyId: number,
  opts: CompanyFilmsOptions = {},
): Promise<TmdbFilmCard[]> {
  const key = process.env.TMDB_API_KEY;
  if (!key) return [];

  const { page = 1, sort = "recent", genreId, minYear, maxYear, minRating, media = "movie" } = opts;
  const isTv = media === "tv";
  const dateField = isTv ? "first_air_date" : "primary_release_date";

  // Le tri par date porte sur un champ différent selon le média.
  const sortBy = (COMPANY_SORT_SQL[sort] ?? COMPANY_SORT_SQL.recent).replace(
    "primary_release_date",
    dateField,
  );

  let extra = `&sort_by=${sortBy}`;
  if (genreId) extra += `&with_genres=${genreId}`;
  if (minYear) extra += `&${dateField}.gte=${minYear}-01-01`;
  if (maxYear) extra += `&${dateField}.lte=${maxYear}-12-31`;
  if (minRating) extra += `&vote_average.gte=${minRating}`;

  // Trier par date fait remonter les projets annoncés sans date fiable, et
  // trier par note fait remonter des titres à 10/10 sur 2 votes. Un plancher
  // de votes règle le second, une borne à aujourd'hui le premier.
  if (sort === "rating") extra += "&vote_count.gte=50";
  if (sort === "recent" && !maxYear) {
    const today = new Date().toISOString().split("T")[0];
    extra += `&${dateField}.lte=${today}`;
  }

  const genreTable = isTv ? TV_GENRES : GENRES;

  try {
    const res = await fetch(
      `${BASE}/discover/${media}?api_key=${key}&language=fr-FR&page=${page}` +
        `&with_companies=${companyId}${extra}`,
      { next: { revalidate: 86400 } },
    );
    if (!res.ok) return [];
    const data = await res.json();
    return ((data.results ?? []) as Record<string, unknown>[])
      .filter((m) => m.poster_path)
      .map((m) => {
        const date = (isTv ? m.first_air_date : m.release_date) as string | undefined;
        return {
          id: m.id as number,
          title: ((isTv ? m.name : m.title) as string) ?? "",
          posterUrl: `${IMG}/w342${m.poster_path}`,
          year: typeof date === "string" ? date.slice(0, 4) : "",
          genres: ((m.genre_ids as number[]) ?? [])
            .slice(0, 2)
            .map((g) => genreTable[g])
            .filter(Boolean),
          voteAverage: m.vote_average ? Math.round((m.vote_average as number) * 10) / 10 : 0,
        };
      });
  } catch {
    return [];
  }
}

// ——————————————————————————————————————————————————————————————
//  Plateformes de visionnage (données JustWatch relayées par TMDB)
// ——————————————————————————————————————————————————————————————

export type WatchProvider = {
  id: number;
  name: string;
  logoUrl: string;
};

export type WatchProviders = {
  /** Inclus dans un abonnement (Netflix, Max…). */
  flatrate: WatchProvider[];
  /** Location à l'acte. */
  rent: WatchProvider[];
  /** Achat définitif. */
  buy: WatchProvider[];
  /** Page JustWatch — son affichage est exigé par les conditions TMDB. */
  link: string;
};

const EMPTY_PROVIDERS: WatchProviders = { flatrate: [], rent: [], buy: [], link: "" };

function mapProviders(list: unknown): WatchProvider[] {
  if (!Array.isArray(list)) return [];
  return (list as Record<string, unknown>[])
    .sort((a, b) => ((a.display_priority as number) ?? 99) - ((b.display_priority as number) ?? 99))
    .map((p) => ({
      id: p.provider_id as number,
      name: (p.provider_name as string) ?? "",
      logoUrl: p.logo_path ? `${IMG}/w92${p.logo_path}` : "",
    }));
}

/**
 * Où regarder un titre, pour une région donnée (France par défaut).
 *
 * TMDB renvoie toutes les régions d'un coup ; on ne garde que celle demandée.
 * Un titre indisponible en France renvoie simplement des listes vides — c'est
 * un cas normal, pas une erreur.
 */
export async function fetchWatchProviders(
  media: "movie" | "tv",
  id: number,
  region: string = "FR",
): Promise<WatchProviders> {
  const key = process.env.TMDB_API_KEY;
  if (!key) return EMPTY_PROVIDERS;
  try {
    const res = await fetch(`${BASE}/${media}/${id}/watch/providers?api_key=${key}`, {
      next: { revalidate: 86400 },
    });
    if (!res.ok) return EMPTY_PROVIDERS;
    const data = await res.json();
    const local = data.results?.[region];
    if (!local) return EMPTY_PROVIDERS;

    return {
      flatrate: mapProviders(local.flatrate),
      rent: mapProviders(local.rent),
      buy: mapProviders(local.buy),
      link: (local.link as string) ?? "",
    };
  } catch {
    return EMPTY_PROVIDERS;
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

/**
 * Mots-clés thématiques.
 *
 * Attention au détail d'API : les films renvoient `keywords`, les séries
 * `results` — même endpoint, clé différente. On lit les deux.
 */
export async function fetchKeywords(media: "movie" | "tv", id: number): Promise<string[]> {
  const key = process.env.TMDB_API_KEY;
  if (!key) return [];
  try {
    const res = await fetch(`${BASE}/${media}/${id}/keywords?api_key=${key}`, {
      next: { revalidate: 86400 },
    });
    if (!res.ok) return [];
    const data = await res.json();
    const list = (data.keywords ?? data.results ?? []) as Array<{ name: string }>;
    return list.map((k) => k.name);
  } catch {
    return [];
  }
}

export async function fetchFilmKeywords(id: number): Promise<string[]> {
  return fetchKeywords("movie", id);
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
