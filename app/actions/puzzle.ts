"use server";

import { getSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import {
  compare,
  getDailySubject,
  getEntry,
  parisDay,
  type GuessResult,
  type PuzzleMedia,
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
  /** Le titre cherché, **uniquement** une fois la partie gagnée. */
  answer: { title: string; posterUrl: string; year: number } | null;
};

/** Relit une partie et recompose les lignes déjà jouées. */
async function loadState(media: PuzzleMedia, userId: string): Promise<PuzzleState> {
  const day = parisDay();
  const answer = await getDailySubject(media, day);
  if (!answer) return { day, available: false, guesses: [], solved: false, answer: null };

  const play = await prisma.puzzlePlay.findUnique({
    where: { userId_media_day: { userId, media, day } },
  });

  const guesses: GuessResult[] = [];
  for (const tmdbId of play?.guesses ?? []) {
    const entry = await getEntry(media, tmdbId);
    if (entry) guesses.push(compare(media, entry, answer));
  }

  const solved = play?.solved ?? false;
  return {
    day,
    available: true,
    // Le plus récent en tête : c'est la ligne qu'on vient de jouer qu'on lit.
    guesses: guesses.reverse(),
    solved,
    answer: solved
      ? { title: answer.title, posterUrl: answer.posterUrl, year: answer.year }
      : null,
  };
}

export async function getPuzzleState(media: PuzzleMedia): Promise<PuzzleState> {
  const session = await getSession();
  if (!session) throw new Error("Non authentifié");
  return loadState(media, session.userId);
}

export async function submitGuess(media: PuzzleMedia, tmdbId: number): Promise<PuzzleState> {
  const session = await getSession();
  if (!session) throw new Error("Non authentifié");

  const day = parisDay();
  const answer = await getDailySubject(media, day);
  if (!answer) throw new Error("Aucune grille disponible aujourd'hui");

  // Une proposition hors vivier n'apprend rien au joueur et polluerait sa
  // grille : on la refuse plutôt que de l'enregistrer.
  const entry = await getEntry(media, tmdbId);
  if (!entry) throw new Error("Ce titre ne fait pas partie du jeu");

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
