import "server-only";
import { prisma } from "@/lib/db";
import { getFilmCards } from "@/lib/films";
import { fetchWatchProviders } from "@/lib/tmdb";
import { WATCH_PROVIDERS, canonicalProvider } from "@/lib/tmdb-catalog";

/**
 * « Que regarder ce soir ? » : les films que le groupe a envie de voir, ceux
 * qui sont dans le plus de listes « À voir » en tête.
 *
 * **Seuls les amis réciproques** peuvent être ajoutés au groupe. Un profil
 * public ne montre que le *nombre* de films à voir, pas leurs titres : se
 * suivre mutuellement vaut accord pour partager sa liste, suivre quelqu'un
 * sans retour ne donne pas accès à la sienne.
 */

/** Soi compris : au-delà, la soirée tourne à la séance de cinéma. */
export const MAX_GROUP_SIZE = 5;
const MAX_RESULTS = 24;
/** Seuls les mieux placés sont interrogés sur leurs plateformes (un appel TMDB chacun). */
const PROVIDER_LOOKUPS = 48;

const PROVIDER_NAME = new Map(WATCH_PROVIDERS.map((p) => [p.id, p.name]));

export type Friend = { id: string; name: string; avatarUrl: string | null };

/** Personnes que l'on suit et qui nous suivent. */
export async function mutualFriends(userId: string): Promise<Friend[]> {
  const rows = await prisma.userFollow.findMany({
    where: {
      followerId: userId,
      following: { following: { some: { followingId: userId } } },
    },
    orderBy: { createdAt: "desc" },
    select: { following: { select: { id: true, name: true, email: true, avatarUrl: true } } },
  });
  return rows.map(({ following: u }) => ({
    id: u.id,
    name: u.name ?? u.email.split("@")[0],
    avatarUrl: u.avatarUrl,
  }));
}

export type TonightFilm = {
  tmdbId: number;
  title: string;
  posterUrl: string;
  year: string;
  voteAverage: number;
  runtime: number | null;
  /** Membres qui l'ont dans « À voir ». */
  wantedBy: string[];
  /** Membres qui l'ont déjà vu. */
  seenBy: string[];
  /** Plateformes du groupe où il est inclus dans l'abonnement. */
  providers: string[];
};

export async function tonightSuggestions(
  members: string[],
  { onPlatforms, maxRuntime }: { onPlatforms: boolean; maxRuntime: number | null },
): Promise<{ films: TonightFilm[]; groupProviders: string[] }> {
  const [wanted, users] = await Promise.all([
    prisma.userFilm.findMany({
      where: { userId: { in: members }, watchlist: true },
      select: { userId: true, tmdbId: true },
    }),
    prisma.user.findMany({ where: { id: { in: members } }, select: { watchProviders: true } }),
  ]);
  // Il suffit qu'une personne du groupe ait la plateforme : on regarde chez elle.
  const groupProviders = new Set(users.flatMap((u) => u.watchProviders));

  const wantedBy = new Map<number, string[]>();
  for (const w of wanted) wantedBy.set(w.tmdbId, [...(wantedBy.get(w.tmdbId) ?? []), w.userId]);
  const ids = [...wantedBy.keys()];
  if (ids.length === 0) return { films: [], groupProviders: [] };

  const [cards, seen, runtimes] = await Promise.all([
    getFilmCards(ids),
    prisma.userFilm.findMany({
      where: { userId: { in: members }, tmdbId: { in: ids }, watched: true },
      select: { userId: true, tmdbId: true },
    }),
    prisma.film.findMany({ where: { tmdbId: { in: ids } }, select: { tmdbId: true, runtime: true } }),
  ]);
  const seenBy = new Map<number, string[]>();
  for (const s of seen) seenBy.set(s.tmdbId, [...(seenBy.get(s.tmdbId) ?? []), s.userId]);
  const runtimeOf = new Map(runtimes.map((r) => [r.tmdbId, r.runtime]));

  const ranked = ids
    .map((id) => {
      const card = cards.get(id);
      return {
        tmdbId: id,
        title: card?.title ?? "Film",
        posterUrl: card?.posterUrl ?? "",
        year: card?.year ?? "",
        voteAverage: card?.voteAverage ?? 0,
        runtime: runtimeOf.get(id) ?? null,
        wantedBy: wantedBy.get(id) ?? [],
        seenBy: seenBy.get(id) ?? [],
      };
    })
    // Vu par tout le monde : rien à proposer. Durée inconnue : on garde.
    .filter((f) => f.seenBy.length < members.length)
    .filter((f) => maxRuntime === null || f.runtime === null || f.runtime <= maxRuntime)
    .sort((a, b) => b.wantedBy.length - a.wantedBy.length || b.voteAverage - a.voteAverage)
    .slice(0, PROVIDER_LOOKUPS);

  const withProviders = await Promise.all(
    ranked.map(async (f) => {
      const { flatrate } = await fetchWatchProviders("movie", f.tmdbId);
      const providers = [...new Set(flatrate.map((p) => canonicalProvider(p.id)))]
        .filter((id) => groupProviders.has(id))
        .map((id) => PROVIDER_NAME.get(id) ?? "");
      return { ...f, providers: providers.filter(Boolean) };
    }),
  );

  return {
    films: withProviders.filter((f) => !onPlatforms || f.providers.length > 0).slice(0, MAX_RESULTS),
    groupProviders: [...groupProviders].map((id) => PROVIDER_NAME.get(id) ?? "").filter(Boolean),
  };
}
