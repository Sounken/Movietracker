/**
 * Moviedle — film (ou série) mystère du jour.
 *
 * Ce fichier ne contient que le modèle : quel est le titre du jour, et que
 * vaut une proposition face à lui. L'affichage et les Server Actions vivent
 * ailleurs, pour que la comparaison reste testable et surtout **hors du
 * navigateur** : la réponse ne doit jamais partir au client.
 */

import { prisma } from "@/lib/db";

export type PuzzleMedia = "movie" | "tv";

/** Une entrée du vivier, telle qu'on la compare. */
export type PuzzleSubject = {
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
};

/**
 * Le jour courant à Paris, en `AAAA-MM-JJ`.
 *
 * Le conteneur tourne en UTC : sans ce calage, le titre du jour changerait à
 * 2h du matin l'été et à 1h l'hiver. `en-CA` parce que son format de date est
 * justement `AAAA-MM-JJ`, ce qui évite de recomposer la chaîne à la main.
 */
export function parisDay(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/**
 * Tirage déterministe à partir du jour.
 *
 * Un `Math.random()` donnerait un titre différent à chaque visiteur, et un
 * index calculé sur le vivier changerait de réponse dès qu'on le recharge.
 * On hache donc la date, et le résultat est **figé en base** à la première
 * partie de la journée (cf. `getDailySubject`) : même si le vivier grossit
 * ensuite, la réponse du jour ne bouge plus.
 */
function hashDay(day: string, media: PuzzleMedia): number {
  let h = 2166136261;
  for (const ch of `${media}:${day}`) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

/** Convertit une ligne de vivier en sujet comparable. */
type EntryRow = {
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
};

/**
 * Le titre à trouver aujourd'hui.
 *
 * Deux temps : on lit `DailyPuzzle` si la journée est déjà tirée, sinon on
 * tire et on enregistre. L'écriture passe par un `upsert` : deux joueurs qui
 * ouvrent la page à la même seconde ne doivent pas obtenir deux réponses
 * différentes, c'est la contrainte d'unicité `(media, day)` qui tranche.
 *
 * Les titres récemment sortis sont écartés du tirage — voir `RECENT_DAYS`.
 */
const RECENT_DAYS = 180;

export async function getDailySubject(
  media: PuzzleMedia,
  day: string = parisDay(),
): Promise<PuzzleSubject | null> {
  const existing = await prisma.dailyPuzzle.findUnique({
    where: { media_day: { media, day } },
  });

  if (existing) {
    const row = await prisma.puzzleEntry.findUnique({
      where: { media_tmdbId: { media, tmdbId: existing.tmdbId } },
    });
    if (row) return toSubject(row);
    // Le titre a disparu du vivier depuis le tirage (nettoyage, rejeu du
    // script) : on retire la journée et on retire au sort ci-dessous.
    await prisma.dailyPuzzle.delete({ where: { id: existing.id } });
  }

  const total = await prisma.puzzleEntry.count({ where: { media } });
  if (total === 0) return null;

  // Les titres déjà sortis récemment sont exclus : sur un vivier de ~2 800
  // entrées le hasard seul ramènerait un doublon bien avant que personne ne
  // l'ait oublié.
  const recent = await prisma.dailyPuzzle.findMany({
    where: { media, day: { lt: day } },
    orderBy: { day: "desc" },
    take: RECENT_DAYS,
    select: { tmdbId: true },
  });
  const excluded = recent.map((r) => r.tmdbId);

  const pool = await prisma.puzzleEntry.count({
    where: { media, tmdbId: { notIn: excluded } },
  });
  // Vivier plus petit que la fenêtre d'exclusion : on relâche la contrainte
  // plutôt que de ne rien proposer.
  const where =
    pool > 0 ? { media, tmdbId: { notIn: excluded } } : { media };
  const count = pool > 0 ? pool : total;

  const row = await prisma.puzzleEntry.findFirst({
    where,
    orderBy: { tmdbId: "asc" },
    skip: hashDay(day, media) % count,
  });
  if (!row) return null;

  await prisma.dailyPuzzle.upsert({
    where: { media_day: { media, day } },
    create: { media, day, tmdbId: row.tmdbId },
    update: {},
  });

  // Course entre deux joueurs : c'est la ligne enregistrée qui fait foi, pas
  // celle qu'on vient de tirer.
  const settled = await prisma.dailyPuzzle.findUnique({
    where: { media_day: { media, day } },
  });
  if (settled && settled.tmdbId !== row.tmdbId) {
    const winner = await prisma.puzzleEntry.findUnique({
      where: { media_tmdbId: { media, tmdbId: settled.tmdbId } },
    });
    if (winner) return toSubject(winner);
  }
  return toSubject(row);
}

function toSubject(row: EntryRow): PuzzleSubject {
  return {
    tmdbId: row.tmdbId,
    title: row.title,
    posterUrl: row.posterUrl,
    year: row.year,
    genres: row.genres,
    countries: row.countries,
    actors: row.actors,
    authors: row.authors,
    runtime: row.runtime,
    seasons: row.seasons,
    network: row.network,
    collection: row.collection,
    voteAverage: row.voteAverage,
  };
}

/* ————————————————————————————————————————————————————————————
   Comparaison
   ———————————————————————————————————————————————————————————— */

/**
 * `partial` n'a de sens que sur les colonnes à valeurs multiples (genres,
 * pays, acteurs) : il dit « une partie commune, pas tout ». `higher` et
 * `lower` désignent la valeur **cherchée** par rapport à la proposition —
 * la flèche montre donc où aller.
 */
export type CellState = "hit" | "partial" | "miss";

export type Cell = {
  key: string;
  label: string;
  /** Ce que porte la proposition, déjà mis en forme. */
  value: string;
  state: CellState;
  direction?: "higher" | "lower";
};

export type GuessResult = {
  tmdbId: number;
  title: string;
  posterUrl: string;
  year: number;
  solved: boolean;
  cells: Cell[];
};

/**
 * Tolérance des colonnes numériques : au-delà d'un écart exact, un
 * « presque » vaut mieux qu'un rouge sec — c'est ce qui rend la déduction
 * possible sur la durée ou la note.
 */
const NEAR = { runtime: 15, seasons: 1, year: 3, rating: 0.5 };

function numericCell(
  key: string,
  label: string,
  guess: number | null,
  answer: number | null,
  near: number,
  format: (v: number) => string,
): Cell {
  if (guess === null || answer === null) {
    return { key, label, value: guess === null ? "—" : format(guess), state: "miss" };
  }
  const diff = answer - guess;
  if (diff === 0) return { key, label, value: format(guess), state: "hit" };
  return {
    key,
    label,
    value: format(guess),
    state: Math.abs(diff) <= near ? "partial" : "miss",
    direction: diff > 0 ? "higher" : "lower",
  };
}

function listCell(key: string, label: string, guess: string[], answer: string[]): Cell {
  const common = guess.filter((v) => answer.includes(v));
  const state: CellState =
    common.length === 0
      ? "miss"
      : common.length === guess.length && guess.length === answer.length
        ? "hit"
        : "partial";
  return { key, label, value: guess.length > 0 ? guess.join(", ") : "—", state };
}

function exactCell(key: string, label: string, guess: string | null, answer: string | null): Cell {
  const value = guess ?? "Aucune";
  // Deux titres sans saga se ressemblent sur ce point : c'est une information,
  // pas une absence de réponse.
  const state: CellState = guess === answer ? "hit" : "miss";
  return { key, label, value, state };
}

const formatYear = (v: number) => String(v);
const formatRuntime = (v: number) => `${v} min`;
const formatSeasons = (v: number) => `${v} saison${v > 1 ? "s" : ""}`;
const formatRating = (v: number) => v.toFixed(1).replace(".", ",");

/**
 * Compare une proposition au titre du jour.
 *
 * Les colonnes diffèrent selon le média : un film a une durée et une saga,
 * une série a un nombre de saisons et une chaîne. Le reste est commun.
 */
export function compare(
  media: PuzzleMedia,
  guess: PuzzleSubject,
  answer: PuzzleSubject,
): GuessResult {
  const cells: Cell[] = [
    numericCell("year", "Année", guess.year, answer.year, NEAR.year, formatYear),
    listCell("genres", "Genres", guess.genres, answer.genres),
    listCell("countries", "Pays", guess.countries, answer.countries),
    listCell(
      "authors",
      media === "movie" ? "Réalisation" : "Création",
      guess.authors,
      answer.authors,
    ),
    listCell("actors", "Têtes d'affiche", guess.actors, answer.actors),
  ];

  if (media === "movie") {
    cells.push(
      numericCell("runtime", "Durée", guess.runtime, answer.runtime, NEAR.runtime, formatRuntime),
      exactCell("collection", "Saga", guess.collection, answer.collection),
    );
  } else {
    cells.push(
      numericCell("seasons", "Saisons", guess.seasons, answer.seasons, NEAR.seasons, formatSeasons),
      exactCell("network", "Chaîne", guess.network, answer.network),
    );
  }

  cells.push(
    numericCell("rating", "Note", guess.voteAverage, answer.voteAverage, NEAR.rating, formatRating),
  );

  return {
    tmdbId: guess.tmdbId,
    title: guess.title,
    posterUrl: guess.posterUrl,
    year: guess.year,
    solved: guess.tmdbId === answer.tmdbId,
    cells,
  };
}

/** Lecture d'une entrée du vivier par identifiant TMDB. */
export async function getEntry(
  media: PuzzleMedia,
  tmdbId: number,
): Promise<PuzzleSubject | null> {
  const row = await prisma.puzzleEntry.findUnique({
    where: { media_tmdbId: { media, tmdbId } },
  });
  return row ? toSubject(row) : null;
}
