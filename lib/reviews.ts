import type { TmdbReview } from "@/lib/tmdb";

/** Un avis tel que l'affichent les fiches film et série. */
export type ReviewCard = {
  id: string;
  name: string;
  avatarUrl: string | null;
  /** Sur 10. */
  rating: number | null;
  /** Vide quand un ami a seulement noté, sans écrire. */
  content: string;
  date: string;
  source: "friend" | "tmdb";
  /** Profil de l'ami, ou page de l'avis sur TMDB. */
  href: string | null;
};

type FriendReview = {
  rating: number | null;
  review: string | null;
  updatedAt: Date;
  user: { id: string; name: string | null; avatarUrl: string | null };
};

/**
 * Avis TMDB gardés : moins quand des amis ont donné leur avis, parce que ce
 * sont eux que le lecteur vient chercher et TMDB ne fait plus que compléter.
 */
const TMDB_WITH_FRIENDS = 3;
const TMDB_ALONE = 6;

function formatDate(value: Date | string): string {
  const date = typeof value === "string" ? new Date(value) : value;
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleDateString("fr-FR");
}

/**
 * Assemble les avis d'une fiche : ceux des amis d'abord, puis TMDB.
 *
 * Seuls les amis — les comptes que l'on suit — apparaissent parmi les membres :
 * un avis écrit sur MovieTracker l'a été pour eux, pas pour n'importe quel
 * visiteur. Sans ami concerné, la section ne montre que TMDB.
 */
export function buildReviewCards(friends: FriendReview[], tmdb: TmdbReview[]): ReviewCard[] {
  const own: ReviewCard[] = friends.map((f) => ({
    id: `friend-${f.user.id}`,
    name: f.user.name ?? "Utilisateur",
    avatarUrl: f.user.avatarUrl,
    rating: f.rating,
    content: f.review?.trim() ?? "",
    date: formatDate(f.updatedAt),
    source: "friend" as const,
    href: `/user/${f.user.id}`,
  }));

  const imported: ReviewCard[] = tmdb
    .slice(0, own.length > 0 ? TMDB_WITH_FRIENDS : TMDB_ALONE)
    .map((r) => ({
      id: `tmdb-${r.id}`,
      name: r.author,
      avatarUrl: r.avatarUrl,
      rating: r.rating,
      content: r.content,
      date: formatDate(r.date),
      source: "tmdb" as const,
      href: r.url || null,
    }));

  return [...own, ...imported];
}
