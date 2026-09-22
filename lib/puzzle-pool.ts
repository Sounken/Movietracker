/**
 * Remplissage du vivier du Moviedle.
 *
 * Le vivier est une **copie figée** : les attributs sont stockés au moment du
 * remplissage plutôt que relus à chaque partie. Sans ça, une grille de huit
 * colonnes jouée par vingt personnes ferait autant d'appels TMDB qu'il y a de
 * propositions — pour des données qui ne changent jamais.
 *
 * Le travail est découpé en pages : `/discover` en rend 20 par appel, et
 * chaque titre demande ensuite son détail (genres, générique, pays). Une seule
 * requête HTTP ne peut pas absorber les ~4 000 appels nécessaires, d'où le
 * découpage piloté par l'appelant.
 */

import { prisma } from "@/lib/db";

const BASE = "https://api.themoviedb.org/3";

export type PuzzleMedia = "movie" | "tv";

/**
 * Planchers de notoriété.
 *
 * **Relevés le 2026-09-22**, en nombre de titres au-dessus du seuil :
 *   films  — 2 000 : 2 807 · 5 000 : 1 065 · 7 000 : 688 · 8 000 : ~560 · 9 000 : 458
 *   séries — 500 : 1 156 · 1 000 : 580 · 1 500 : 363 · 2 000 : 238
 *
 * Le premier réglage (2 000 / 500) donnait un jeu trop difficile : à ce seuil
 * passent quantité de films corrects mais que personne n'a en tête, et une
 * grille ne se déduit que si les propositions du joueur sont elles-mêmes dans
 * le vivier. On vise donc **environ 500 titres par média** — assez pour ne pas
 * tourner en rond (500 jours, et les 180 derniers sont exclus du tirage),
 * assez peu pour que tout soit reconnaissable.
 *
 * Les deux valeurs restent volontairement différentes : les séries reçoivent
 * bien moins de votes que les films. 1 000 les place à une notoriété
 * comparable, pas à un seuil comparable.
 */
export const MIN_VOTES: Record<PuzzleMedia, number> = { movie: 8000, tv: 1000 };

/** Nombre de détails demandés en parallèle. TMDB tolère large, mais rien ne
 *  sert de saturer : le remplissage n'est pas dans le chemin d'un utilisateur. */
const CONCURRENCY = 8;

type Json = Record<string, unknown>;

async function tmdb(path: string): Promise<Json | null> {
  const key = process.env.TMDB_API_KEY;
  if (!key) return null;
  const sep = path.includes("?") ? "&" : "?";
  try {
    const res = await fetch(`${BASE}${path}${sep}api_key=${key}&language=fr-FR`, {
      cache: "no-store",
    });
    if (!res.ok) return null;
    return (await res.json()) as Json;
  } catch {
    return null;
  }
}

/** Exécute `task` sur chaque élément, `CONCURRENCY` à la fois. */
async function mapLimit<T, R>(items: T[], task: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = [];
  for (let i = 0; i < items.length; i += CONCURRENCY) {
    out.push(...(await Promise.all(items.slice(i, i + CONCURRENCY).map(task))));
  }
  return out;
}

type EntryData = {
  media: PuzzleMedia;
  tmdbId: number;
  title: string;
  posterUrl: string;
  year: number;
  genres: string[];
  countries: string[];
  actors: string[];
  authors: string[];
  runtime: number | null;
  seasons: number | null;
  network: string | null;
  collection: string | null;
  voteAverage: number;
  voteCount: number;
};

function names(list: unknown, max: number): string[] {
  if (!Array.isArray(list)) return [];
  return list.slice(0, max).map((v) => String((v as Json).name ?? "")).filter(Boolean);
}

async function buildFilm(id: number): Promise<EntryData | null> {
  const d = await tmdb(`/movie/${id}?append_to_response=credits`);
  if (!d || !d.title || typeof d.release_date !== "string" || !d.release_date) return null;
  const credits = (d.credits ?? {}) as Json;
  const crew = Array.isArray(credits.crew) ? (credits.crew as Json[]) : [];
  return {
    media: "movie",
    tmdbId: id,
    title: String(d.title),
    posterUrl: d.poster_path ? `https://image.tmdb.org/t/p/w342${d.poster_path}` : "",
    year: Number(String(d.release_date).slice(0, 4)),
    genres: names(d.genres, 5),
    countries: Array.isArray(d.production_countries)
      ? (d.production_countries as Json[]).map((c) => String(c.iso_3166_1)).slice(0, 4)
      : [],
    actors: names(credits.cast, 3),
    authors: crew.filter((c) => c.job === "Director").map((c) => String(c.name)).slice(0, 3),
    runtime: typeof d.runtime === "number" && d.runtime > 0 ? d.runtime : null,
    seasons: null,
    network: null,
    collection: d.belongs_to_collection
      ? String((d.belongs_to_collection as Json).name ?? "")
      : null,
    voteAverage: Math.round(Number(d.vote_average ?? 0) * 10) / 10,
    voteCount: Number(d.vote_count ?? 0),
  };
}

async function buildSeries(id: number): Promise<EntryData | null> {
  const d = await tmdb(`/tv/${id}?append_to_response=credits`);
  if (!d || !d.name || typeof d.first_air_date !== "string" || !d.first_air_date) return null;
  const credits = (d.credits ?? {}) as Json;
  return {
    media: "tv",
    tmdbId: id,
    title: String(d.name),
    posterUrl: d.poster_path ? `https://image.tmdb.org/t/p/w342${d.poster_path}` : "",
    year: Number(String(d.first_air_date).slice(0, 4)),
    genres: names(d.genres, 5),
    countries: Array.isArray(d.origin_country)
      ? (d.origin_country as string[]).map(String).slice(0, 4)
      : [],
    actors: names(credits.cast, 3),
    authors: names(d.created_by, 3),
    runtime: null,
    seasons: typeof d.number_of_seasons === "number" ? d.number_of_seasons : null,
    // La première chaîne suffit : les suivantes sont des diffuseurs
    // secondaires, que personne n'associe à la série.
    network: names(d.networks, 1)[0] ?? null,
    collection: null,
    voteAverage: Math.round(Number(d.vote_average ?? 0) * 10) / 10,
    voteCount: Number(d.vote_count ?? 0),
  };
}

export type BuildReport = {
  media: PuzzleMedia;
  from: number;
  to: number;
  /** Page à demander au prochain appel, ou `null` si le vivier est complet. */
  nextPage: number | null;
  totalPages: number;
  written: number;
  skipped: number;
  /** Entrées supprimées parce que sous le plancher courant (dernière page). */
  pruned: number;
};

/**
 * Remplit le vivier sur une tranche de pages `/discover`.
 *
 * Renvoie la page suivante à traiter : c'est à l'appelant d'enchaîner, une
 * requête HTTP ne pouvant pas porter les milliers d'appels nécessaires.
 */
export async function buildPool(
  media: PuzzleMedia,
  from = 1,
  pages = 5,
): Promise<BuildReport> {
  const path = media === "movie" ? "/discover/movie" : "/discover/tv";
  const filter = `?sort_by=popularity.desc&vote_count.gte=${MIN_VOTES[media]}`;

  let written = 0;
  let skipped = 0;
  let totalPages = 0;
  let page = from;
  const last = from + pages - 1;

  for (; page <= last; page++) {
    const list = await tmdb(`${path}${filter}&page=${page}`);
    if (!list) break;
    totalPages = Math.min(Number(list.total_pages ?? 0), 500); // TMDB plafonne à 500
    const results = Array.isArray(list.results) ? (list.results as Json[]) : [];
    if (results.length === 0) break;

    const entries = await mapLimit(results, (r) =>
      media === "movie" ? buildFilm(Number(r.id)) : buildSeries(Number(r.id)),
    );

    for (const e of entries) {
      // Un titre sans genre ni générique ne donnerait qu'une grille de tirets :
      // il est inutile comme réponse comme comme proposition.
      if (!e || e.genres.length === 0 || e.actors.length === 0 || !e.year) {
        skipped++;
        continue;
      }
      const { media: m, tmdbId, ...rest } = e;
      await prisma.puzzleEntry.upsert({
        where: { media_tmdbId: { media: m, tmdbId } },
        create: { media: m, tmdbId, ...rest },
        update: rest,
      });
      written++;
    }

    if (page >= totalPages) {
      page++;
      break;
    }
  }

  const done = totalPages > 0 && page > totalPages;

  // Le vivier est purgé **à la fin du parcours seulement** : le faire à chaque
  // tranche supprimerait des titres encore valides avant de les avoir
  // réécrits. Sans cette purge, relever le plancher laisserait en place tout
  // ce qu'un réglage précédent y avait mis.
  let pruned = 0;
  if (done) {
    const res = await prisma.puzzleEntry.deleteMany({
      where: { media, voteCount: { lt: MIN_VOTES[media] } },
    });
    pruned = res.count;
  }

  return {
    pruned,
    media,
    from,
    to: page - 1,
    nextPage: done ? null : page,
    totalPages,
    written,
    skipped,
  };
}
