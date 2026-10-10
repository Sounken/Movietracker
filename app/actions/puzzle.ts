"use server";

import { cookies } from "next/headers";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import {
  compare,
  getDailySubject,
  getEntry,
  hintsFor,
  parisDay,
  type GuessResult,
  type PuzzleHint,
  type PuzzleMedia,
  type PuzzleSubject,
} from "@/lib/puzzle";

/**
 * Propositions du Moviedle.
 *
 * Toute la comparaison se fait ici, côté serveur, et la réponse du jour ne
 * quitte jamais le processus : renvoyée au client — même dans un état React
 * jamais affiché — elle se lirait dans le source de la page, et le jeu
 * n'aurait plus d'intérêt. Le navigateur ne reçoit que des couleurs.
 */

export type PuzzleState = {
  day: string;
  /**
   * Faux quand le vivier est vide : l'écran doit le dire au lieu de laisser
   * une recherche qui ne répond jamais — c'est exactement ce qui s'est
   * produit au premier déploiement, avant le remplissage.
   */
  available: boolean;
  guesses: GuessResult[];
  solved: boolean;
  hints: PuzzleHint[];
  /** Le titre cherché, **uniquement** une fois la partie gagnée. */
  answer: { title: string; posterUrl: string; year: number } | null;
};

const unavailable = (day: string): PuzzleState => ({
  day,
  available: false,
  guesses: [],
  solved: false,
  hints: [],
  answer: null,
});

/** Recompose l'état d'une partie à partir de la liste des titres proposés. */
async function composeState(
  media: PuzzleMedia,
  day: string,
  answer: PuzzleSubject,
  played: number[],
): Promise<PuzzleState> {
  const guesses: GuessResult[] = [];
  for (const tmdbId of played) {
    const entry = await getEntry(media, tmdbId);
    if (entry) guesses.push(compare(media, entry, answer));
  }

  const solved = played.includes(answer.tmdbId);
  return {
    day,
    available: true,
    // Le plus récent en tête : c'est la ligne qu'on vient de jouer qu'on lit.
    guesses: guesses.reverse(),
    solved,
    hints: hintsFor(media, answer, guesses.length),
    answer: solved
      ? { title: answer.title, posterUrl: answer.posterUrl, year: answer.year }
      : null,
  };
}

/** Relit la partie d'un membre et recompose les lignes déjà jouées. */
async function loadState(media: PuzzleMedia, userId: string): Promise<PuzzleState> {
  const day = parisDay();
  const answer = await getDailySubject(media, day);
  if (!answer) return unavailable(day);

  const play = await prisma.puzzlePlay.findUnique({
    where: { userId_media_day: { userId, media, day } },
  });
  return composeState(media, day, answer, play?.guesses ?? []);
}

/* ————————————————————————————————————————————————————————————
   Partie sans compte
   ———————————————————————————————————————————————————————————— */

/**
 * Sans compte, la grille du jour vit dans un cookie plutôt qu'en base : un
 * visiteur de passage n'a pas à créer de ligne, et le stockage Neon est
 * compté. Le cookie ne contient que les identifiants proposés — jamais la
 * réponse, que le serveur relit à chaque coup. Le modifier à la main ne sert
 * à rien : chaque ligne est recalculée face au titre du jour.
 */
const guestCookie = (media: PuzzleMedia) => `moviedle-${media}`;
/** Plafond défensif : le cookie est éditable, sa taille ne doit pas l'être sans limite. */
const GUEST_MAX_GUESSES = 150;

async function readGuestGuesses(media: PuzzleMedia, day: string): Promise<number[]> {
  const raw = (await cookies()).get(guestCookie(media))?.value;
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as { day?: unknown; guesses?: unknown };
    // Grille d'un autre jour : on repart de zéro, comme un membre.
    if (parsed.day !== day || !Array.isArray(parsed.guesses)) return [];
    return [...new Set(parsed.guesses)]
      .filter((v): v is number => Number.isInteger(v) && (v as number) > 0)
      .slice(0, GUEST_MAX_GUESSES);
  } catch {
    return [];
  }
}

async function writeGuestGuesses(media: PuzzleMedia, day: string, guesses: number[]) {
  (await cookies()).set(guestCookie(media), JSON.stringify({ day, guesses }), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    // Deux jours : de quoi couvrir le passage de minuit, pas davantage.
    maxAge: 60 * 60 * 48,
  });
}

async function loadGuestState(media: PuzzleMedia): Promise<PuzzleState> {
  const day = parisDay();
  const answer = await getDailySubject(media, day);
  if (!answer) return unavailable(day);
  return composeState(media, day, answer, await readGuestGuesses(media, day));
}

/* ———————————————————————————————————————————————————————————— */

export async function getPuzzleState(media: PuzzleMedia): Promise<PuzzleState> {
  const session = await getSession();
  if (!session) return loadGuestState(media);
  return loadState(media, session.userId);
}

export async function submitGuess(media: PuzzleMedia, tmdbId: number): Promise<PuzzleState> {
  // Le média vient du client : on ne le laisse pas désigner autre chose.
  if (media !== "movie" && media !== "tv") throw new Error("Jeu inconnu");
  if (!Number.isInteger(tmdbId) || tmdbId <= 0) throw new Error("Proposition invalide");

  const session = await getSession();

  const day = parisDay();
  const answer = await getDailySubject(media, day);
  if (!answer) throw new Error("Aucune grille disponible aujourd'hui");

  // Une proposition hors vivier n'apprend rien au joueur et polluerait sa
  // grille : on la refuse plutôt que de l'enregistrer.
  const entry = await getEntry(media, tmdbId);
  if (!entry) throw new Error("Ce titre ne fait pas partie du jeu");

  if (!session) {
    const played = await readGuestGuesses(media, day);
    // Mêmes règles qu'un membre : rien après la victoire, pas de doublon.
    if (
      !played.includes(answer.tmdbId) &&
      !played.includes(tmdbId) &&
      played.length < GUEST_MAX_GUESSES
    ) {
      played.push(tmdbId);
      await writeGuestGuesses(media, day, played);
    }
    return composeState(media, day, answer, played);
  }

  const play = await prisma.puzzlePlay.findUnique({
    where: { userId_media_day: { userId: session.userId, media, day } },
  });

  // Partie déjà gagnée, ou titre déjà proposé : on ne réécrit rien. Un doublon
  // dans la grille ferait croire à une erreur d'affichage.
  if (play?.solved || play?.guesses.includes(tmdbId)) {
    return loadState(media, session.userId);
  }

  const solved = tmdbId === answer.tmdbId;
  const guesses = [...(play?.guesses ?? []), tmdbId];

  await prisma.puzzlePlay.upsert({
    where: { userId_media_day: { userId: session.userId, media, day } },
    create: {
      userId: session.userId,
      media,
      day,
      guesses,
      solved,
      solvedAt: solved ? new Date() : null,
    },
    update: { guesses, solved, solvedAt: solved ? new Date() : null },
  });

  return loadState(media, session.userId);
}

/**
 * Série de victoires : nombre de jours consécutifs gagnés jusqu'à hier
 * inclus, plus aujourd'hui s'il est déjà trouvé.
 *
 * Calculé à la lecture plutôt que stocké : une colonne `streak` se
 * désynchroniserait au premier jour sauté, et le volume ne justifie pas
 * l'entretien d'un compteur.
 */
export async function getStreak(media: PuzzleMedia): Promise<number> {
  const session = await getSession();
  if (!session) return 0;

  const plays = await prisma.puzzlePlay.findMany({
    where: { userId: session.userId, media, solved: true },
    orderBy: { day: "desc" },
    select: { day: true },
    take: 400,
  });
  if (plays.length === 0) return 0;

  const days = new Set(plays.map((p) => p.day));
  const today = parisDay();

  // On part d'aujourd'hui s'il est gagné, d'hier sinon : une grille non encore
  // jouée ne doit pas casser une série en cours.
  const cursor = new Date(`${today}T12:00:00Z`);
  if (!days.has(today)) cursor.setUTCDate(cursor.getUTCDate() - 1);

  let streak = 0;
  for (;;) {
    const key = parisDay(cursor);
    if (!days.has(key)) break;
    streak++;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  return streak;
}
