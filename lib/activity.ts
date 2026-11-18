import "server-only";
import * as Sentry from "@sentry/nextjs";
import { prisma } from "@/lib/db";
import { getFilmCards } from "@/lib/films";
import { getSeriesCards } from "@/lib/series";

/**
 * Fil d'activité : ce que font les personnes qu'on suit (et soi-même).
 *
 * Une activité se crée au moment de l'action — noter, dater un visionnage —
 * et garde la note de l'instant. Elle n'est pas déduite après coup de
 * `UserFilm.updatedAt`, qui bouge aussi quand on retire un film de « À voir »,
 * et elle a un identifiant stable sur lequel réagir.
 */

export type ActivityMedia = "movie" | "tv";

/**
 * Enregistre une activité sans jamais faire échouer l'action qui l'a
 * déclenchée : la note est déjà sauvée, un fil incomplet vaut mieux qu'une
 * erreur affichée pour rien. L'échec part dans GlitchTip.
 */
export async function track(work: Promise<unknown>): Promise<void> {
  try {
    await work;
  } catch (error) {
    Sentry.captureException(error);
  }
}

/** Réactions proposées. Toute autre valeur est refusée. */
export const REACTION_EMOJIS = ["❤️", "🔥", "😂", "😮", "😢", "👏"] as const;

export function isReactionEmoji(value: string): value is (typeof REACTION_EMOJIS)[number] {
  return (REACTION_EMOJIS as readonly string[]).includes(value);
}

/**
 * Fenêtre de regroupement : noter un film puis le dater dans la foulée donne
 * une seule activité, complétée, plutôt que deux lignes pour le même geste.
 */
const MERGE_WINDOW_MS = 12 * 60 * 60 * 1000;

/** Avis gardé avec l'activité : de quoi en lire le début dans le fil. */
const REVIEW_SNAPSHOT_LENGTH = 600;

function recentActivity(userId: string, media: ActivityMedia, tmdbId: number) {
  return prisma.activity.findFirst({
    where: { userId, media, tmdbId, createdAt: { gte: new Date(Date.now() - MERGE_WINDOW_MS) } },
    orderBy: { createdAt: "desc" },
  });
}

/** Une note (et son avis) vient d'être enregistrée. */
export async function recordRating(
  userId: string,
  media: ActivityMedia,
  tmdbId: number,
  rating: number,
  review: string,
) {
  const reviewSnapshot = review.trim().slice(0, REVIEW_SNAPSHOT_LENGTH) || null;

  const recent = await recentActivity(userId, media, tmdbId);
  if (recent) {
    await prisma.activity.update({
      where: { id: recent.id },
      data: { rating, review: reviewSnapshot },
    });
    return;
  }

  // Réenregistrer la même note et le même avis (bouton « Sauvegarder » sans
  // changement, par exemple) n'est pas une nouvelle activité.
  const last = await prisma.activity.findFirst({
    where: { userId, media, tmdbId },
    orderBy: { createdAt: "desc" },
    select: { rating: true, review: true },
  });
  if (last && last.rating === rating && last.review === reviewSnapshot) return;

  await prisma.activity.create({
    data: { userId, media, tmdbId, kind: "rated", rating, review: reviewSnapshot },
  });
}

/** Un visionnage vient d'être ajouté au journal. */
export async function recordWatch(
  userId: string,
  tmdbId: number,
  filmWatchId: string,
  rewatch: boolean,
) {
  const kind = rewatch ? "rewatched" : "watched";
  const recent = await recentActivity(userId, "movie", tmdbId);
  if (recent && !recent.filmWatchId) {
    await prisma.activity.update({ where: { id: recent.id }, data: { kind, filmWatchId } });
    return;
  }

  const film = await prisma.userFilm.findUnique({
    where: { userId_tmdbId: { userId, tmdbId } },
    select: { rating: true },
  });
  await prisma.activity.create({
    data: { userId, media: "movie", tmdbId, kind, filmWatchId, rating: film?.rating ?? null },
  });
}

/**
 * Une ligne du journal va être supprimée : son activité disparaît si elle ne
 * portait que ce visionnage, sinon elle redevient une simple note.
 */
export async function forgetWatch(filmWatchId: string) {
  const activity = await prisma.activity.findUnique({ where: { filmWatchId } });
  if (!activity) return;
  if (activity.rating == null) {
    await prisma.activity.delete({ where: { id: activity.id } });
  } else {
    await prisma.activity.update({
      where: { id: activity.id },
      data: { kind: "rated", filmWatchId: null },
    });
  }
}

/** La note a été retirée : le fil ne doit plus l'afficher. */
export async function forgetRating(userId: string, media: ActivityMedia, tmdbId: number) {
  await prisma.$transaction([
    prisma.activity.deleteMany({ where: { userId, media, tmdbId, filmWatchId: null } }),
    prisma.activity.updateMany({
      where: { userId, media, tmdbId },
      data: { rating: null, review: null },
    }),
  ]);
}

/** Auteurs visibles par `viewerId` : les personnes suivies, et lui-même. */
async function visibleAuthors(viewerId: string): Promise<string[]> {
  const follows = await prisma.userFollow.findMany({
    where: { followerId: viewerId },
    select: { followingId: true },
  });
  return [viewerId, ...follows.map((f) => f.followingId)];
}

/** `viewerId` peut-il voir (et donc réagir à) cette activité ? */
export async function canSeeActivity(viewerId: string, authorId: string): Promise<boolean> {
  if (viewerId === authorId) return true;
  const follow = await prisma.userFollow.findUnique({
    where: { followerId_followingId: { followerId: viewerId, followingId: authorId } },
    select: { id: true },
  });
  return follow !== null;
}

export type ReactionSummary = { emoji: string; count: number; mine: boolean };

export function summarizeReactions(
  reactions: { emoji: string; userId: string }[],
  viewerId: string,
): ReactionSummary[] {
  // Ordre fixe, celui du sélecteur : une pastille ne change pas de place
  // quand son compteur dépasse celui de sa voisine.
  return REACTION_EMOJIS.map((emoji) => {
    const forEmoji = reactions.filter((r) => r.emoji === emoji);
    return { emoji, count: forEmoji.length, mine: forEmoji.some((r) => r.userId === viewerId) };
  }).filter((r) => r.count > 0);
}

export type FeedItem = {
  id: string;
  kind: "rated" | "watched" | "rewatched";
  tmdbId: number;
  title: string;
  posterUrl: string;
  year: string;
  rating: number | null;
  review: string | null;
  /** Visionnage daté : jour (ISO) et remarque. */
  watchedAt: string | null;
  note: string | null;
  createdAt: string;
  user: { id: string; name: string; avatarUrl: string | null };
  isMine: boolean;
  reactions: ReactionSummary[];
};

export const FEED_PAGE_SIZE = 20;

/**
 * Page du fil d'un monde (films ou séries), la plus récente d'abord.
 * `before` : identifiant de la dernière activité déjà affichée.
 */
export async function getFeed(
  viewerId: string,
  media: ActivityMedia,
  before?: string,
): Promise<{ items: FeedItem[]; hasMore: boolean }> {
  const authors = await visibleAuthors(viewerId);
  const cursor = before
    ? await prisma.activity.findFirst({
        where: { id: before, userId: { in: authors }, media },
        select: { id: true },
      })
    : null;

  const rows = await prisma.activity.findMany({
    where: { userId: { in: authors }, media },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: FEED_PAGE_SIZE + 1,
    ...(cursor ? { cursor: { id: cursor.id }, skip: 1 } : {}),
    include: {
      user: { select: { id: true, name: true, email: true, avatarUrl: true } },
      reactions: { select: { emoji: true, userId: true } },
      filmWatch: { select: { watchedAt: true, note: true } },
    },
  });
  const hasMore = rows.length > FEED_PAGE_SIZE;
  const page = rows.slice(0, FEED_PAGE_SIZE);

  const ids = page.map((a) => a.tmdbId);
  const cards: Map<number, { title: string; posterUrl: string; year: string }> =
    media === "movie"
      ? await getFilmCards(ids)
      : new Map(
          [...(await getSeriesCards(ids))].map(([id, c]) => [id, { ...c, title: c.name }] as const),
        );

  return {
    hasMore,
    items: page.map((a) => {
      const card = cards.get(a.tmdbId);
      return {
        id: a.id,
        kind: a.kind as FeedItem["kind"],
        tmdbId: a.tmdbId,
        title: card?.title ?? (media === "movie" ? "Film inconnu" : "Série inconnue"),
        posterUrl: card?.posterUrl ?? "",
        year: card?.year ?? "",
        rating: a.rating,
        review: a.review,
        watchedAt: a.filmWatch?.watchedAt.toISOString() ?? null,
        note: a.filmWatch?.note ?? null,
        createdAt: a.createdAt.toISOString(),
        user: {
          id: a.user.id,
          // L'adresse ne sort jamais du serveur : seul son début sert de nom.
          name: a.user.name ?? a.user.email.split("@")[0],
          avatarUrl: a.user.avatarUrl,
        },
        isMine: a.userId === viewerId,
        reactions: summarizeReactions(a.reactions, viewerId),
      };
    }),
  };
}
