"use client";

import { useState, useEffect, useCallback, useTransition, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { followUser, unfollowUser } from "@/app/actions/friends";
import { Check, Heart } from "lucide-react";
import styles from "./friends.module.css";
import { Rating } from "@/lib/rating-scale";

type FollowingUser = { id: string; name: string; avatarUrl: string | null; filmCount: number; avgRating: number | null };
type FollowerUser  = { id: string; name: string; avatarUrl: string | null; followsBack: boolean };
type ActivityItem  = {
  id: string; tmdbId: number; title: string; posterUrl: string | null; year: string;
  watched: boolean; liked: boolean; rating: number | null;
  updatedAt: string;
  user: { id: string; name: string; avatarUrl: string | null };
};
type SearchResult  = { id: string; name: string; avatarUrl: string | null; filmCount: number; isFollowing: boolean };

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 60) return `Il y a ${m}min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `Il y a ${h}h`;
  const d = Math.floor(h / 24);
  return `Il y a ${d}j`;
}

function Avatar({ url, name, size = 38 }: { url: string | null; name: string; size?: number }) {
  if (url) return <Image src={url} alt={name} className={styles.avatar} width={size} height={size} />;
  return (
    <div className={styles.avatarFallback} style={{ width: size, height: size, fontSize: size * 0.4 }}>
      {name[0]?.toUpperCase()}
    </div>
  );
}

export default function FriendsClient({
  following: initialFollowing,
  followers,
  activity,
  mediaBase = "/film",
  countNoun = "film",
}: {
  following: FollowingUser[];
  followers: FollowerUser[];
  activity: ActivityItem[];
  /** « /film » (défaut) ou « /series » — base des liens d'activité */
  mediaBase?: string;
  /** « film » (défaut) ou « série » — nom pour les compteurs */
  countNoun?: string;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const search = useCallback((q: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (q.length < 2) return;
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/users/search?q=${encodeURIComponent(q)}`);
        if (res.ok) setResults(await res.json());
      } finally {
        setSearching(false);
      }
    }, 300);
  }, []);

  useEffect(() => { search(query); }, [query, search]);

  function toggle(userId: string, isFollowing: boolean) {
    setPendingIds((prev) => new Set([...prev, userId]));
    startTransition(async () => {
      if (isFollowing) await unfollowUser(userId);
      else await followUser(userId);
      router.refresh();
      setPendingIds((prev) => { const s = new Set(prev); s.delete(userId); return s; });
    });
  }

  const followingIds = new Set(initialFollowing.map((f) => f.id));

  return (
    <div className={styles.page}>
      {/* ——— Header */}
      <div className={styles.header}>
        <div>
          <div className={styles.headerSub}>Social</div>
          <h1 className={styles.headerTitle}>Amis</h1>
        </div>
        <div className={styles.searchWrap}>
          <SearchIcon />
          <input
            className={styles.searchInput}
            placeholder="Rechercher par nom ou email…"
            value={query}
            onChange={(e) => {
              const q = e.target.value;
              setQuery(q);
              if (q.length < 2) setResults([]);
            }}
          />
          {searching && <div className={styles.searchSpinner} />}
        </div>
      </div>

      {/* ——— Search results */}
      {query.length >= 2 && (
        <div className={styles.section}>
          <div className={styles.sectionTitle}>
            Résultats{results.length > 0 ? ` · ${results.length}` : ""}
          </div>
          {results.length === 0 && !searching && (
            <div className={styles.empty}>Aucun utilisateur trouvé pour « {query} »</div>
          )}
          <div className={styles.userList}>
            {results.map((u) => {
              const isFollowing = followingIds.has(u.id) || u.isFollowing;
              return (
                <div key={u.id} className={styles.userCard}>
                  <Link href={`/user/${u.id}`} className={styles.userLink}>
                    <Avatar url={u.avatarUrl} name={u.name} />
                    <div className={styles.userInfo}>
                      <div className={styles.userName}>{u.name}</div>
                      <div className={styles.userMeta}>{u.filmCount} {countNoun}{u.filmCount !== 1 ? "s" : ""} dans la collection</div>
                    </div>
                  </Link>
                  <button
                    className={isFollowing ? styles.btnUnfollow : styles.btnFollow}
                    onClick={() => toggle(u.id, isFollowing)}
                    disabled={pendingIds.has(u.id)}
                  >
                    {pendingIds.has(u.id) ? "…" : isFollowing ? <>Suivi <Check size={12} /></> : "+ Suivre"}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className={styles.cols}>
        {/* ——— Left col: Following + Followers */}
        <div className={styles.leftCol}>
          {/* Following */}
          <div className={styles.section}>
            <div className={styles.sectionTitle}>
              Tu suis
              <span className={styles.sectionCount}>{initialFollowing.length}</span>
            </div>
            {initialFollowing.length === 0 ? (
              <div className={styles.empty}>Tu ne suis personne encore. Recherche des amis ci-dessus.</div>
            ) : (
              <div className={styles.userList}>
                {initialFollowing.map((u) => (
                  <div key={u.id} className={styles.userCard}>
                    <Link href={`/user/${u.id}`} className={styles.userLink}>
                      <Avatar url={u.avatarUrl} name={u.name} />
                      <div className={styles.userInfo}>
                        <div className={styles.userName}>{u.name}</div>
                        <div className={styles.userMeta}>
                          {u.filmCount} {countNoun}{u.filmCount !== 1 ? "s" : ""}
                          {u.avgRating != null && <> · ★ <Rating value={u.avgRating} /></>}
                        </div>
                      </div>
                    </Link>
                    <button
                      className={styles.btnUnfollow}
                      onClick={() => toggle(u.id, true)}
                      disabled={pendingIds.has(u.id)}
                    >
                      {pendingIds.has(u.id) ? "…" : <>Suivi <Check size={12} /></>}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Followers */}
          <div className={styles.section}>
            <div className={styles.sectionTitle}>
              Tes abonnés
              <span className={styles.sectionCount}>{followers.length}</span>
            </div>
            {followers.length === 0 ? (
              <div className={styles.empty}>Personne ne te suit encore.</div>
            ) : (
              <div className={styles.userList}>
                {followers.map((u) => (
                  <div key={u.id} className={styles.userCard}>
                    <Link href={`/user/${u.id}`} className={styles.userLink}>
                      <Avatar url={u.avatarUrl} name={u.name} />
                      <div className={styles.userInfo}>
                        <div className={styles.userName}>{u.name}</div>
                        {u.followsBack && <div className={styles.mutualBadge}>Abonné mutuel</div>}
                      </div>
                    </Link>
                    {!u.followsBack && (
                      <button
                        className={styles.btnFollow}
                        onClick={() => toggle(u.id, false)}
                        disabled={pendingIds.has(u.id)}
                      >
                        {pendingIds.has(u.id) ? "…" : "+ Suivre"}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ——— Right col: Activity feed */}
        <div className={styles.rightCol}>
          <div className={styles.section}>
            <div className={styles.sectionTitle}>
              Activité récente
              <span className={styles.sectionCount}>{activity.length}</span>
            </div>
            {initialFollowing.length === 0 ? (
              <div className={styles.empty}>Suis des amis pour voir leur activité ici.</div>
            ) : activity.length === 0 ? (
              <div className={styles.empty}>Aucune activité récente.</div>
            ) : (
              <div className={styles.feed}>
                {activity.map((item) => (
                  <div key={item.id} className={styles.feedItem}>
                    <Avatar url={item.user.avatarUrl} name={item.user.name} size={34} />
                    <div className={styles.feedContent}>
                      <div className={styles.feedText}>
                        <Link href={`/user/${item.user.id}`} className={styles.feedName}>
                          {item.user.name}
                        </Link>
                        {item.liked && !item.rating && " a aimé "}
                        {item.watched && !item.rating && !item.liked && " a regardé "}
                        {item.rating != null && " a noté "}
                        <Link href={`${mediaBase}/${item.tmdbId}`} className={styles.feedFilm}>
                          {item.title}
                        </Link>
                        {item.rating != null && (
                          <span className={styles.feedRating}> ★ <Rating value={item.rating} /></span>
                        )}
                        {item.liked && <span className={styles.feedLiked}> <Heart size={11} fill="currentColor" /></span>}
                      </div>
                      <div className={styles.feedTime}>{timeAgo(item.updatedAt)}</div>
                    </div>
                    {item.posterUrl && (
                      <div className={styles.feedPoster}>
                        <Image
                          src={item.posterUrl}
                          alt={item.title}
                          fill
                          sizes="30px"
                          style={{ objectFit: "cover" }}
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

const SearchIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
    <circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" />
  </svg>
);
