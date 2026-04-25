"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { Period, FilmRanking, GenreStat, ActiveUser, RecentReview } from "./page";
import styles from "./trends.module.css";

type Stats = {
  totalUsers: number;
  totalWatched: number;
  totalRated: number;
  totalReviews: number;
  totalWatchlist: number;
  totalHours: number;
};

type TabKey = "watched" | "liked" | "rated" | "watchlisted";

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 60) return `Il y a ${m}min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `Il y a ${h}h`;
  const d = Math.floor(h / 24);
  return `Il y a ${d}j`;
}

function Avatar({ url, name, size = 36 }: { url: string | null; name: string; size?: number }) {
  if (url)
    return (
      <img
        src={url}
        alt={name}
        className={styles.avatar}
        style={{ width: size, height: size }}
      />
    );
  return (
    <div
      className={styles.avatarFallback}
      style={{ width: size, height: size, fontSize: size * 0.38 }}
    >
      {name[0]?.toUpperCase()}
    </div>
  );
}

const PERIOD_LABELS: Record<Period, string> = {
  week: "Cette semaine",
  month: "Ce mois",
  year: "Cette année",
  all: "Tout",
};

const TAB_LABELS: Record<TabKey, string> = {
  watched: "Vus",
  liked: "Aimés",
  rated: "Notés",
  watchlisted: "Watchlist",
};

export default function TrendsClient({
  period,
  stats,
  topWatched,
  topLiked,
  topRated,
  topWatchlisted,
  genres,
  recentReviews,
  activeUsers,
}: {
  period: Period;
  stats: Stats;
  topWatched: FilmRanking[];
  topLiked: FilmRanking[];
  topRated: FilmRanking[];
  topWatchlisted: FilmRanking[];
  genres: GenreStat[];
  recentReviews: RecentReview[];
  activeUsers: ActiveUser[];
}) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabKey>("watched");

  const tabData: Record<TabKey, FilmRanking[]> = {
    watched: topWatched,
    liked: topLiked,
    rated: topRated,
    watchlisted: topWatchlisted,
  };

  const currentList = tabData[activeTab];
  const maxCount = currentList[0]?.count ?? 1;

  function setPeriod(p: Period) {
    router.push(`/trends?period=${p}`);
  }

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.header}>
        <div>
          <div className={styles.headerSub}>Communauté</div>
          <h1 className={styles.headerTitle}>Tendances</h1>
        </div>
        <div className={styles.periodPills}>
          {(Object.keys(PERIOD_LABELS) as Period[]).map((p) => (
            <button
              key={p}
              className={`${styles.pill} ${period === p ? styles.pillOn : ""}`}
              onClick={() => setPeriod(p)}
            >
              {PERIOD_LABELS[p]}
            </button>
          ))}
        </div>
      </div>

      {/* Stats bar */}
      <div className={styles.statsGrid}>
        <StatCard value={stats.totalWatched} label="Films vus" icon="👁" />
        <StatCard value={stats.totalRated} label="Notes données" icon="★" />
        <StatCard value={stats.totalReviews} label="Avis rédigés" icon="✍" />
        <StatCard value={stats.totalWatchlist} label="En watchlist" icon="🕐" />
        <StatCard value={stats.totalHours} label="Heures visionnées" icon="⏱" suffix="h" />
        <StatCard value={stats.totalUsers} label="Utilisateurs" icon="👤" />
      </div>

      {/* Two-column layout */}
      <div className={styles.cols}>
        {/* Left: Top films */}
        <div className={styles.mainCol}>
          <div className={styles.section}>
            <div className={styles.sectionHead}>
              <div className={styles.sectionTitle}>Top films</div>
              <div className={styles.tabs}>
                {(Object.keys(TAB_LABELS) as TabKey[]).map((tab) => (
                  <button
                    key={tab}
                    className={`${styles.tab} ${activeTab === tab ? styles.tabOn : ""}`}
                    onClick={() => setActiveTab(tab)}
                  >
                    {TAB_LABELS[tab]}
                  </button>
                ))}
              </div>
            </div>

            {currentList.length === 0 ? (
              <div className={styles.empty}>Aucune donnée pour cette période.</div>
            ) : (
              <div className={styles.rankList}>
                {currentList.map((film, i) => (
                  <Link key={film.tmdbId} href={`/film/${film.tmdbId}`} className={styles.rankItem}>
                    <span className={`${styles.rankNum} ${i < 3 ? styles.rankTop : ""}`}>
                      {i + 1}
                    </span>
                    {film.posterUrl ? (
                      <img
                        src={film.posterUrl}
                        alt={film.title}
                        className={styles.rankPoster}
                      />
                    ) : (
                      <div className={styles.rankPosterFallback} />
                    )}
                    <div className={styles.rankInfo}>
                      <div className={styles.rankTitle}>{film.title}</div>
                      <div className={styles.rankMeta}>
                        {film.year}
                        {film.genres.length > 0 && (
                          <> · {film.genres.slice(0, 2).join(", ")}</>
                        )}
                      </div>
                      <div className={styles.rankBar}>
                        <div
                          className={styles.rankBarFill}
                          style={{ width: `${Math.round((film.count / maxCount) * 100)}%` }}
                        />
                      </div>
                    </div>
                    <div className={styles.rankBadge}>
                      {activeTab === "rated" && film.avgRating != null ? (
                        <span className={styles.rankRating}>★ {film.avgRating.toFixed(1)}</span>
                      ) : (
                        <span className={styles.rankCount}>{film.count}</span>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Recent reviews */}
          <div className={styles.section} style={{ marginTop: 24 }}>
            <div className={styles.sectionHead}>
              <div className={styles.sectionTitle}>Avis récents</div>
              <span className={styles.sectionCount}>{recentReviews.length}</span>
            </div>
            {recentReviews.length === 0 ? (
              <div className={styles.empty}>Aucun avis pour cette période.</div>
            ) : (
              <div className={styles.reviewList}>
                {recentReviews.map((r) => (
                  <div key={r.id} className={styles.reviewCard}>
                    {r.posterUrl && (
                      <Link href={`/film/${r.tmdbId}`}>
                        <img src={r.posterUrl} alt={r.title} className={styles.reviewPoster} />
                      </Link>
                    )}
                    <div className={styles.reviewBody}>
                      <div className={styles.reviewTop}>
                        <Avatar url={r.user.avatarUrl} name={r.user.name} size={28} />
                        <div className={styles.reviewMeta}>
                          <span className={styles.reviewUser}>{r.user.name}</span>
                          {" · "}
                          <Link href={`/film/${r.tmdbId}`} className={styles.reviewFilm}>
                            {r.title}
                          </Link>
                          {r.rating != null && (
                            <span className={styles.reviewRating}> ★ {r.rating}</span>
                          )}
                        </div>
                        <span className={styles.reviewTime}>{timeAgo(r.updatedAt)}</span>
                      </div>
                      <p className={styles.reviewText}>{r.review}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right: Genre distribution + Active users */}
        <div className={styles.sideCol}>
          {/* Genre distribution */}
          <div className={styles.section}>
            <div className={styles.sectionHead}>
              <div className={styles.sectionTitle}>Genres populaires</div>
            </div>
            {genres.length === 0 ? (
              <div className={styles.empty}>Pas assez de données.</div>
            ) : (
              <div className={styles.genreList}>
                {genres.map((g) => (
                  <div key={g.genre} className={styles.genreItem}>
                    <div className={styles.genreLabel}>
                      <span className={styles.genreName}>{g.genre}</span>
                      <span className={styles.genrePercent}>{g.percent}%</span>
                    </div>
                    <div className={styles.genreTrack}>
                      <div className={styles.genreBar} style={{ width: `${g.percent}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Most active users */}
          <div className={styles.section} style={{ marginTop: 24 }}>
            <div className={styles.sectionHead}>
              <div className={styles.sectionTitle}>Utilisateurs actifs</div>
              <span className={styles.sectionCount}>{activeUsers.length}</span>
            </div>
            {activeUsers.length === 0 ? (
              <div className={styles.empty}>Aucune activité pour cette période.</div>
            ) : (
              <div className={styles.userList}>
                {activeUsers.map((u, i) => (
                  <div key={u.id} className={styles.userCard}>
                    <span className={styles.userRank}>{i + 1}</span>
                    <Avatar url={u.avatarUrl} name={u.name} size={34} />
                    <div className={styles.userInfo}>
                      <div className={styles.userName}>{u.name}</div>
                      <div className={styles.userMeta}>{u.count} action{u.count !== 1 ? "s" : ""}</div>
                    </div>
                    <div className={styles.userCount}>{u.count}</div>
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

function StatCard({
  value,
  label,
  icon,
  suffix = "",
}: {
  value: number;
  label: string;
  icon: string;
  suffix?: string;
}) {
  return (
    <div className={styles.statCard}>
      <div className={styles.statIcon}>{icon}</div>
      <div className={styles.statValue}>
        {value.toLocaleString("fr")}
        {suffix}
      </div>
      <div className={styles.statLabel}>{label}</div>
    </div>
  );
}
