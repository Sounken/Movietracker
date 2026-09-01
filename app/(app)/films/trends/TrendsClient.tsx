"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Eye, Star, PenLine, Clock, Users, type LucideIcon } from "lucide-react";
import type {
  Period,
  TitleRanking,
  GenreStat,
  ActiveUser,
  RecentReview,
  TrendsStats,
} from "@/lib/trends";
import styles from "./trends.module.css";
import { Rating } from "@/lib/rating-scale";

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
      <Image
        src={url}
        alt={name}
        className={styles.avatar}
        width={size}
        height={size}
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
  basePath = "/films/trends",
  mediaBase = "/film",
  media = "film",
}: {
  period: Period;
  stats: TrendsStats;
  topWatched: TitleRanking[];
  topLiked: TitleRanking[];
  topRated: TitleRanking[];
  topWatchlisted: TitleRanking[];
  genres: GenreStat[];
  recentReviews: RecentReview[];
  activeUsers: ActiveUser[];
  /** Route de la page elle-même, pour les liens de période. */
  basePath?: string;
  /** Base des liens vers une fiche : « /film » ou « /series ». */
  mediaBase?: string;
  /** Détermine les libellés (« Top films » / « Top séries »…). */
  media?: "film" | "series";
}) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabKey>("watched");

  const isSeries = media === "series";
  // Les profils publics sont scindés par monde, comme les fiches.
  const profileBase = isSeries ? "/series/user" : "/user";
  const labels = {
    topTitle: isSeries ? "Top séries" : "Top films",
    watchedStat: isSeries ? "Séries suivies" : "Films vus",
  };

  const tabData: Record<TabKey, TitleRanking[]> = {
    watched: topWatched,
    liked: topLiked,
    rated: topRated,
    watchlisted: topWatchlisted,
  };

  const currentList = tabData[activeTab];
  const maxCount = currentList[0]?.count ?? 1;

  function setPeriod(p: Period) {
    router.push(`${basePath}?period=${p}`);
  }

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.header}>
        <div>
          <div className={styles.headerSub}>Communauté</div>
          <h1 className={styles.headerTitle}>Tendances{isSeries ? " séries" : ""}</h1>
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
        <StatCard value={stats.totalWatched} label={labels.watchedStat} icon={Eye} />
        <StatCard value={stats.totalRated} label="Notes données" icon={Star} />
        <StatCard value={stats.totalReviews} label="Avis rédigés" icon={PenLine} />
        <StatCard value={stats.totalHours} label="Heures visionnées" icon={Clock} suffix="h" />
        <StatCard value={stats.totalUsers} label="Utilisateurs" icon={Users} />
      </div>

      {/* Two-column layout */}
      <div className={styles.cols}>
        {/* Left: Top films */}
        <div className={styles.mainCol}>
          <div className={styles.section}>
            <div className={styles.sectionHead}>
              <div className={styles.sectionTitle}>{labels.topTitle}</div>
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
                  <Link key={film.tmdbId} href={`${mediaBase}/${film.tmdbId}`} className={styles.rankItem}>
                    <span className={`${styles.rankNum} ${i < 3 ? styles.rankTop : ""}`}>
                      {i + 1}
                    </span>
                    {film.posterUrl ? (
                      <Image
                        src={film.posterUrl}
                        alt={film.title}
                        className={styles.rankPoster}
                        width={36}
                        height={54}
                      />
                    ) : (
                      <div className={styles.rankPosterFallback} />
                    )}
                    <div className={styles.rankInfo}>
                      <div className={styles.rankTitle}>{film.title}</div>
                      <div className={styles.rankMeta}>
                        {film.year}
                        {film.genres.length > 0 && (
                          <> • {film.genres.slice(0, 2).join(", ")}</>
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
                        <span className={styles.rankRating}>★ <Rating value={film.avgRating} /></span>
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
          <div className={styles.section}>
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
                      <Link href={`${mediaBase}/${r.tmdbId}`}>
                        <Image src={r.posterUrl} alt={r.title} className={styles.reviewPoster} width={48} height={72} />
                      </Link>
                    )}
                    <div className={styles.reviewBody}>
                      <div className={styles.reviewTop}>
                        <Link href={`${profileBase}/${r.user.id}`}>
                          <Avatar url={r.user.avatarUrl} name={r.user.name} size={28} />
                        </Link>
                        <div className={styles.reviewMeta}>
                          <Link href={`${profileBase}/${r.user.id}`} className={styles.reviewUser}>
                            {r.user.name}
                          </Link>
                          {" • "}
                          <Link href={`${mediaBase}/${r.tmdbId}`} className={styles.reviewFilm}>
                            {r.title}
                          </Link>
                          {r.rating != null && (
                            <span className={styles.reviewRating}> ★ <Rating value={r.rating} /></span>
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
          <div className={styles.section}>
            <div className={styles.sectionHead}>
              <div className={styles.sectionTitle}>Utilisateurs actifs</div>
              <span className={styles.sectionCount}>{activeUsers.length}</span>
            </div>
            {activeUsers.length === 0 ? (
              <div className={styles.empty}>Aucune activité pour cette période.</div>
            ) : (
              <div className={styles.userList}>
                {activeUsers.map((u, i) => (
                  <Link key={u.id} href={`${profileBase}/${u.id}`} className={styles.userCard}>
                    <span className={styles.userRank}>{i + 1}</span>
                    <Avatar url={u.avatarUrl} name={u.name} size={34} />
                    <div className={styles.userInfo}>
                      <div className={styles.userName}>{u.name}</div>
                      <div className={styles.userMeta}>{u.count} action{u.count !== 1 ? "s" : ""}</div>
                    </div>
                    <div className={styles.userCount}>{u.count}</div>
                  </Link>
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
  icon: Icon,
  suffix = "",
}: {
  value: number;
  label: string;
  icon: LucideIcon;
  suffix?: string;
}) {
  return (
    <div className={styles.statCard}>
      <div className={styles.statIcon}><Icon size={18} /></div>
      <div className={styles.statValue}>
        {value.toLocaleString("fr")}
        {suffix}
      </div>
      <div className={styles.statLabel}>{label}</div>
    </div>
  );
}
