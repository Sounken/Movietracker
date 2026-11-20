import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import { MAX_GROUP_SIZE, mutualFriends, tonightSuggestions } from "@/lib/tonight";
import { formatRuntime } from "@/lib/tmdb";
import TonightControls from "./TonightControls";
import DrawButton from "./DrawButton";
import styles from "./ce-soir.module.css";

export const metadata: Metadata = { title: "Que regarder ce soir ?", robots: { index: false } };

const RUNTIMES = [105, 135];

export default async function TonightPage({
  searchParams,
}: {
  searchParams: Promise<{ avec?: string; plateformes?: string; duree?: string }>;
}) {
  const [session, query] = await Promise.all([getSession(), searchParams]);
  if (!session) redirect("/login");
  const userId = session.userId;

  const [friends, me] = await Promise.all([
    mutualFriends(userId),
    prisma.user.findUnique({ where: { id: userId }, select: { name: true, email: true, avatarUrl: true } }),
  ]);
  // Seuls des amis réciproques, et pas plus que la taille de groupe permise.
  const friendIds = new Set(friends.map((f) => f.id));
  const selected = [...new Set((query.avec ?? "").split(",").filter((id) => friendIds.has(id)))].slice(
    0,
    MAX_GROUP_SIZE - 1,
  );
  const onPlatforms = query.plateformes === "1";
  const maxRuntime = RUNTIMES.includes(Number(query.duree)) ? Number(query.duree) : null;

  const members = [userId, ...selected];
  const { films, groupProviders } = await tonightSuggestions(members, { onPlatforms, maxRuntime });

  const people = new Map([
    [userId, { name: "Vous", avatarUrl: me?.avatarUrl ?? null }],
    ...friends.map((f) => [f.id, { name: f.name, avatarUrl: f.avatarUrl }] as const),
  ]);
  const topCount = films[0]?.wantedBy.length ?? 0;

  return (
    <div>

      <div className={styles.head}>
        <div className={styles.sectionSub}>Social</div>
        <h2 className={styles.sectionTitle}>Que regarder ce soir ?</h2>
        <p className={styles.lead}>
          Choisissez jusqu&apos;à {MAX_GROUP_SIZE - 1} amis : les films qui sont dans le plus de listes
          « À voir » passent en tête.
        </p>
      </div>

      <TonightControls
        friends={friends}
        selected={selected}
        onPlatforms={onPlatforms}
        maxRuntime={maxRuntime}
        maxFriends={MAX_GROUP_SIZE - 1}
        hasGroupProviders={groupProviders.length > 0}
      />

      {friends.length === 0 && (
        <p className={styles.note}>
          Seuls les amis réciproques (vous vous suivez mutuellement) peuvent rejoindre le groupe :
          leur liste « À voir » n&apos;est partagée qu&apos;avec eux. En attendant, voici la vôtre.
        </p>
      )}

      {films.length === 0 ? (
        <div className={styles.empty}>
          {onPlatforms || maxRuntime
            ? "Aucun film ne correspond à ces filtres."
            : "Aucun film dans les listes « À voir » du groupe pour l'instant."}
        </div>
      ) : (
        <>
          <div className={styles.resultsHead}>
            <span className={styles.count}>
              {films.length} film{films.length > 1 ? "s" : ""}
              {groupProviders.length > 0 && <> • plateformes du groupe : {groupProviders.join(", ")}</>}
            </span>
            <DrawButton
              candidates={films
                .filter((f) => f.wantedBy.length === topCount)
                .map((f) => ({ tmdbId: f.tmdbId, title: f.title, posterUrl: f.posterUrl, year: f.year }))}
            />
          </div>

          <ul className={styles.grid}>
            {films.map((f, i) => (
              <li key={f.tmdbId} className={styles.card}>
                <Link href={`/film/${f.tmdbId}`} className={styles.posterLink}>
                  {f.posterUrl ? (
                    <Image src={f.posterUrl} alt="" width={200} height={300} className={styles.poster} loading={i < 6 ? "eager" : undefined} />
                  ) : (
                    <span className={styles.poster} />
                  )}
                  {members.length > 1 && (
                    <span className={styles.wantBadge}>
                      {f.wantedBy.length}/{members.length}
                    </span>
                  )}
                </Link>
                <div className={styles.cardBody}>
                  <Link href={`/film/${f.tmdbId}`} className={styles.title}>
                    {f.title}
                  </Link>
                  <div className={styles.meta}>
                    {[f.year, f.runtime ? formatRuntime(f.runtime) : null].filter(Boolean).join(" • ")}
                  </div>
                  <div className={styles.avatars} aria-label={`Envie de : ${f.wantedBy.map((id) => people.get(id)?.name).join(", ")}`}>
                    {f.wantedBy.map((id) => {
                      const p = people.get(id);
                      return p?.avatarUrl ? (
                        <Image key={id} src={p.avatarUrl} alt="" width={22} height={22} className={styles.avatar} title={p.name} />
                      ) : (
                        <span key={id} className={styles.avatar} title={p?.name}>
                          {(p?.name ?? "?").charAt(0).toUpperCase()}
                        </span>
                      );
                    })}
                  </div>
                  {f.providers.length > 0 && <div className={styles.providers}>Sur {f.providers.join(", ")}</div>}
                  {f.seenBy.length > 0 && (
                    <div className={styles.seen}>
                      Déjà vu par {f.seenBy.map((id) => people.get(id)?.name ?? "?").join(", ")}
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
