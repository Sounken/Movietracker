import { NextRequest, NextResponse } from "next/server";
import { relevance, queryVariants, effectiveScore, MEDIA_PRIORITY } from "@/lib/search";

const IMG = "https://image.tmdb.org/t/p/w185";
const PROFILE_IMG = "https://image.tmdb.org/t/p/w185";

const DEPT_LABELS: Record<string, string> = {
  Acting: "Acteur",
  Directing: "Réalisateur",
  Writing: "Scénariste",
  Production: "Production",
  Sound: "Musique",
  Camera: "Image",
  Editing: "Montage",
  Art: "Direction artistique",
};

type Row = {
  id: number;
  mediaType: "movie" | "tv" | "person" | "company";
  title: string;
  year: string;
  posterUrl: string;
  voteAverage: number | null;
  /** Pour les personnes : métier + films connus. */
  subtitle?: string;
  popularity: number;
  votes: number;
  score: number;
};

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q");
  // "multi"        = films + séries + personnes + studios (monde Films)
  // "series-multi"  = séries + personnes ayant travaillé en série + studios
  // "movie" / "tv"  = un seul média (pickers de favoris)
  const type = request.nextUrl.searchParams.get("type");
  if (!q || q.trim().length < 2) return NextResponse.json([]);

  const key = process.env.TMDB_API_KEY;
  if (!key) return NextResponse.json([]);

  const variants = queryVariants(q);
  const search = async (kind: string, query: string) => {
    const url = `https://api.themoviedb.org/3/search/${kind}?api_key=${key}&query=${encodeURIComponent(query)}&language=fr-FR`;
    try {
      const res = await fetch(url, { next: { revalidate: 300 } });
      if (!res.ok) return [] as Record<string, unknown>[];
      const data = await res.json();
      return (data.results ?? []) as Record<string, unknown>[];
    } catch {
      return [] as Record<string, unknown>[];
    }
  };

  /** Toutes les variantes pour un type donné, dédoublonnées par id. */
  const searchAll = async (kind: string) => {
    const pages = await Promise.all(variants.map((v) => search(kind, v)));
    const seen = new Set<number>();
    const out: Record<string, unknown>[] = [];
    for (const page of pages) {
      for (const item of page) {
        const id = item.id as number;
        if (seen.has(id)) continue;
        seen.add(id);
        out.push(item);
      }
    }
    return out;
  };

  const toMovie = (m: Record<string, unknown>): Row => ({
    id: m.id as number,
    mediaType: "movie",
    title: (m.title as string) ?? "",
    year: typeof m.release_date === "string" ? m.release_date.slice(0, 4) : "",
    posterUrl: m.poster_path ? `${IMG}${m.poster_path}` : "",
    voteAverage: m.vote_average ? Math.round((m.vote_average as number) * 10) / 10 : null,
    popularity: (m.popularity as number) ?? 0,
    votes: (m.vote_count as number) ?? 0,
    score: relevance([m.title as string, m.original_title as string], q),
  });

  const toSeries = (s: Record<string, unknown>): Row => ({
    id: s.id as number,
    mediaType: "tv",
    title: (s.name as string) ?? "",
    year: typeof s.first_air_date === "string" ? s.first_air_date.slice(0, 4) : "",
    posterUrl: s.poster_path ? `${IMG}${s.poster_path}` : "",
    voteAverage: s.vote_average ? Math.round((s.vote_average as number) * 10) / 10 : null,
    popularity: (s.popularity as number) ?? 0,
    votes: (s.vote_count as number) ?? 0,
    score: relevance([s.name as string, s.original_name as string], q),
  });

  const toCompany = (c: Record<string, unknown>): Row => ({
    id: c.id as number,
    mediaType: "company",
    title: (c.name as string) ?? "",
    year: "",
    // Les logos TMDB sont en PNG noir sur transparent ; l'affichage les inverse.
    posterUrl: c.logo_path ? `${IMG}${c.logo_path}` : "",
    voteAverage: null,
    subtitle: "Studio",
    popularity: 0,
    votes: 0,
    score: relevance([c.name as string], q),
  });

  /** Studios correspondant à la requête, les mieux dotés d'abord. */
  const searchCompanies = async (): Promise<Row[]> => {
    const raw = await searchAll("company");
    return raw
      .map(toCompany)
      .filter((r) => r.score > 0)
      // TMDB renvoie beaucoup de coquilles vides homonymes ; celles qui ont un
      // logo sont quasi toujours les vraies.
      .sort((a, b) => Number(Boolean(b.posterUrl)) - Number(Boolean(a.posterUrl)) || b.score - a.score)
      .slice(0, 2);
  };

  /** Une personne, avec son métier et ses œuvres notables. */
  const toPerson = (p: Record<string, unknown>): Row => {
    const knownFor = ((p.known_for ?? []) as Record<string, unknown>[]);
    const titles = knownFor
      .map((k) => (k.title as string) ?? (k.name as string))
      .filter(Boolean)
      .slice(0, 2);
    const dept = DEPT_LABELS[p.known_for_department as string] ?? "Cinéma";
    return {
      id: p.id as number,
      mediaType: "person",
      title: (p.name as string) ?? "",
      year: "",
      posterUrl: p.profile_path ? `${PROFILE_IMG}${p.profile_path}` : "",
      voteAverage: null,
      subtitle: titles.length > 0 ? `${dept} · ${titles.join(", ")}` : dept,
      popularity: (p.popularity as number) ?? 0,
      votes: 0,
      score: relevance([p.name as string], q, true),
    };
  };

  /**
   * A-t-elle travaillé en série ?
   *
   * Dans le monde Séries, chercher « nolan » ne doit pas proposer une fiche
   * qui ne contient que des films. `known_for` porte le type de chaque œuvre
   * notable : c'est une heuristique — il n'en liste que trois — mais elle ne
   * coûte aucun appel supplémentaire, là où vérifier les crédits TV réels
   * demanderait une requête par personne.
   */
  const hasTvWork = (p: Record<string, unknown>): boolean =>
    ((p.known_for ?? []) as Record<string, unknown>[]).some((k) => k.media_type === "tv");

  // Tri commun : pertinence (corrigée de la notoriété) d'abord, film avant
  // série à égalité, puis popularité.
  const byRelevance = (a: Row, b: Row) =>
    effectiveScore(b) - effectiveScore(a) ||
    MEDIA_PRIORITY[a.mediaType] - MEDIA_PRIORITY[b.mediaType] ||
    b.popularity - a.popularity;

  const strip = (r: Row) => ({
    id: r.id,
    mediaType: r.mediaType,
    title: r.title,
    year: r.year,
    posterUrl: r.posterUrl,
    voteAverage: r.voteAverage,
    subtitle: r.subtitle,
  });

  // ——— Séries uniquement (picker « séries préférées ») ———
  if (type === "tv") {
    const rows = (await searchAll("tv")).map(toSeries).filter((r) => r.score > 0);
    return NextResponse.json(rows.sort(byRelevance).slice(0, 6).map(strip));
  }

  // ——— Monde Séries : séries + gens de série + studios ———
  if (type === "series-multi") {
    const [tvRaw, personRaw, companies] = await Promise.all([
      searchAll("tv"),
      searchAll("person"),
      searchCompanies(),
    ]);

    const series = tvRaw.map(toSeries).filter((r) => r.score > 0).sort(byRelevance).slice(0, 8);

    const people = personRaw
      .filter(hasTvWork)
      .map(toPerson)
      .filter((r) => r.score > 0)
      .sort(byRelevance)
      .slice(0, 3);

    const merged = [...series, ...people, ...companies].sort(byRelevance).slice(0, 10);
    return NextResponse.json(merged.map(strip));
  }

  // ——— Films uniquement (picker « films préférés ») ———
  if (type !== "multi") {
    const rows = (await searchAll("movie")).map(toMovie).filter((r) => r.score > 0);
    return NextResponse.json(rows.sort(byRelevance).slice(0, 6).map(strip));
  }

  // ——— Recherche globale : films + séries + personnes + studios ———
  const [movieRaw, tvRaw, personRaw, companies] = await Promise.all([
    searchAll("movie"),
    searchAll("tv"),
    searchAll("person"),
    searchCompanies(),
  ]);

  const people = personRaw
    .map(toPerson)
    .filter((r) => r.score > 0)
    .sort(byRelevance)
    // Plafonnées : sans ça, une recherche de titre courant noierait les films
    // sous les homonymes d'acteurs.
    .slice(0, 3);

  const titles = [...movieRaw.map(toMovie), ...tvRaw.map(toSeries)]
    .filter((r) => r.score > 0)
    .sort(byRelevance)
    .slice(0, 8);

  const merged = [...titles, ...people, ...companies].sort(byRelevance).slice(0, 10);

  return NextResponse.json(merged.map(strip));
}
