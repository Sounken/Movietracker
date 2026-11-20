import Link from "next/link";
import Image from "next/image";
import { prisma } from "@/lib/db";
import { Rating } from "@/lib/rating-scale";
import type { TmdbCastMember, TmdbFilmCard, TmdbSeriesDetail } from "@/lib/tmdb";
import type { ReviewCard } from "@/lib/reviews";
import type { AssistantState } from "@/lib/rating-assistant";
import { saveSeriesRating, deleteSeriesRating } from "@/app/actions/series";
import WatchProvidersSection from "../../components/WatchProvidersSection";
import TrailerSection from "../../components/TrailerSection";
import AwardsAsync from "../../components/AwardsAsync";
import ExternalLinks from "../../components/ExternalLinks";
import { DetailCard, PosterRail, RatingsCard } from "../../film/[id]/nocturne/parts";
import { BackButton, HeroActions, MyRating, ReviewsBlock, SectionTabs } from "../../film/[id]/nocturne/FilmNocturneClient";
import SeasonTracker from "./SeasonTracker";
import styles from "../../film/[id]/nocturne/film-nocturne.module.css";

type Props = {
  series: TmdbSeriesDetail;
  isAuthenticated: boolean;
  logoUrl: string | null;
  certification: string | null;
  video: Parameters<typeof TrailerSection>[0]["video"] | null;
  statusLabel: string;
  authorName: string | null;
  facts: { k: string; v: React.ReactNode }[];
  externalIds: Parameters<typeof ExternalLinks>[0]["ids"] & { wikidataId: string | null };
  cast: TmdbCastMember[];
  keywords: string[];
  providers: Parameters<typeof WatchProvidersSection>[0]["providers"];
  myProviders: Parameters<typeof WatchProvidersSection>[0]["mine"];
  reviews: ReviewCard[];
  friendRatings: { rating: number | null; user: { id: string; name: string | null; avatarUrl: string | null } }[];
  similar: TmdbFilmCard[];
  userSeries: { rating: number | null; review: string | null; watchlist: boolean; liked: boolean } | null;
  ratingDetail: { state: AssistantState; score: number } | null;
  totalWatched: number;
  globalPct: number;
  watchedBySeason: Record<number, number>;
  ratingBySeason: Record<number, number>;
};

const SECTIONS = [
  { id: "apercu", label: "Aperçu" },
  { id: "episodes", label: "Épisodes" },
  { id: "casting", label: "Casting" },
  { id: "critiques", label: "Critiques" },
  { id: "similaires", label: "Similaires" },
];

/**
 * Fiche série, direction Nocturne : même gabarit que la fiche film (hero sous
 * l'en-tête, colonne de l'affiche collante, onglets), avec le suivi par
 * saison à la place du journal.
 */
export default async function SeriesNocturne(p: Props) {
  const { series } = p;

  const community = await prisma.userSeries.findMany({
    where: { tmdbId: series.id, rating: { not: null } },
    select: { rating: true },
  });
  const communityRatings = community.map((c) => c.rating!);
  const avg = (xs: number[]) => (xs.length ? xs.reduce((s, v) => s + v, 0) / xs.length : null);
  const friendRated = p.friendRatings.filter((f) => f.rating !== null);
  const friendsAvg = avg(friendRated.map((f) => f.rating!));

  const sections = SECTIONS.filter(
    (s) =>
      (s.id !== "episodes" || series.seasons.length > 0) &&
      (s.id !== "casting" || p.cast.length > 0) &&
      (s.id !== "similaires" || p.similar.length > 0),
  );

  return (
    <div className={styles.page} data-hero>
      <section className={styles.hero}>
        {series.backdropUrl && (
          <div className={styles.kb}>
            <Image src={series.backdropUrl} alt="" fill priority sizes="100vw" style={{ objectFit: "cover" }} />
          </div>
        )}
        <div className={styles.veil} />

        <div className={styles.heroText}>
          <BackButton className={styles.back} fallbackHref="/series" />
          <div className={styles.kicker}>
            {p.certification && <span className={styles.cert}>{p.certification}</span>}
            {series.genres.slice(0, 3).join(" • ")}
          </div>
          {p.logoUrl ? (
            <Image src={p.logoUrl} alt={series.name} width={0} height={0} sizes="560px" className={styles.logo} priority />
          ) : (
            <h1 className={styles.title} style={{ fontSize: series.name.length > 18 ? 64 : 104 }}>{series.name}</h1>
          )}
          <div className={styles.meta}>
            {series.year && <span>{series.year}</span>}
            <span>
              {series.numberOfSeasons} saison{series.numberOfSeasons > 1 ? "s" : ""} • {series.numberOfEpisodes} épisodes
            </span>
            {p.statusLabel && <span>{p.statusLabel}</span>}
            {p.authorName && <span>de {p.authorName}</span>}
            {series.voteAverage > 0 && (
              <span className={styles.score}>
                ★ <Rating value={series.voteAverage} />
                <span className={styles.scoreSub}>TMDB</span>
              </span>
            )}
          </div>
          <HeroActions
            kind="series"
            tmdbId={series.id}
            title={series.name}
            hasTrailer={Boolean(p.video)}
            initialWatchlist={p.userSeries?.watchlist ?? false}
            initialLiked={p.userSeries?.liked ?? false}
            isAuthenticated={p.isAuthenticated}
          />
        </div>

        <div className={styles.whereCol}>
          <WatchProvidersSection
            providers={p.providers}
            mine={p.myProviders}
            sectionClassName={`${styles.glass} ${styles.where}`}
            titleClassName={styles.glassTitle}
            compact
          />
        </div>
      </section>

      <div className={styles.body}>
        <aside className={styles.side}>
          <div className={styles.poster}>
            {series.posterUrl && <Image src={series.posterUrl} alt={series.name} fill sizes="320px" priority style={{ objectFit: "cover" }} />}
          </div>

          <MyRating
            tmdbId={series.id}
            title={series.name}
            initialRating={p.userSeries?.rating ?? 0}
            initialReview={p.userSeries?.review ?? ""}
            isAuthenticated={p.isAuthenticated}
            saveAction={saveSeriesRating}
            deleteAction={deleteSeriesRating}
            media="tv"
            initialDetail={p.ratingDetail?.state ?? null}
          />

          {p.isAuthenticated && (
            <div className={`${styles.card} ${styles.friends}`}>
              <div className={styles.cardHead}>
                <span className={styles.cardTitle}>Ma progression</span>
                <span className={styles.mono}>{p.globalPct} %</span>
              </div>
              <div className={styles.progressTrack}>
                <span className={styles.progressFill} style={{ width: `${p.globalPct}%` }} />
              </div>
              <span className={styles.friendsText}>
                {p.totalWatched > 0
                  ? `${p.totalWatched} épisode${p.totalWatched > 1 ? "s" : ""} vu${p.totalWatched > 1 ? "s" : ""} sur ${series.numberOfEpisodes}`
                  : "Aucun épisode coché pour l'instant"}
              </span>
              <a href="#episodes" className={styles.softBtn}>Suivre les épisodes</a>
            </div>
          )}

          <div className={styles.sideWhere}>
            <WatchProvidersSection
              providers={p.providers}
              mine={p.myProviders}
              sectionClassName={`${styles.card} ${styles.whereCard}`}
              titleClassName={styles.cardTitle}
              compact
            />
          </div>
        </aside>

        <div className={styles.main}>
          <SectionTabs sections={sections} />

          <section id="apercu" className={`${styles.anchor} ${styles.overview}`}>
            <div className={styles.synopsisCol}>
              <div className={styles.eyebrow}>Synopsis</div>
              {series.tagline && <p className={styles.tagline}>{series.tagline}</p>}
              <p className={styles.synopsis}>{series.overview || "Aucun synopsis disponible."}</p>
              {p.keywords.length > 0 && (
                <div className={styles.chips}>
                  {p.keywords.slice(0, 6).map((k) => (
                    <span key={k} className={styles.chip}>{k}</span>
                  ))}
                </div>
              )}
              {/* Même place que sur la fiche film : elle comble la colonne du
                  synopsis face à la fiche technique. */}
              {p.video && (
                <div id="bande-annonce" className={`${styles.anchor} ${styles.trailer}`}>
                  <TrailerSection video={p.video} title={series.name} sectionClassName={styles.block} titleClassName={styles.eyebrow} />
                </div>
              )}
            </div>
            <div className={`${styles.card} ${styles.facts}`}>
              {p.facts.map((f) => (
                <div key={f.k} className={styles.fact}>
                  <span className={styles.factK}>{f.k}</span>
                  <span className={styles.factV}>{f.v}</span>
                </div>
              ))}
              <ExternalLinks ids={p.externalIds} homepage={series.homepage} />
            </div>
          </section>

          {series.seasons.length > 0 && (
            <section id="episodes" className={`${styles.anchor} ${styles.block}`}>
              <h2 className={styles.h2}>Épisodes</h2>
              <SeasonTracker
                seriesId={series.id}
                seasons={series.seasons}
                watchedBySeason={p.watchedBySeason}
                ratingBySeason={p.ratingBySeason}
                isAuthenticated={p.isAuthenticated}
              />
            </section>
          )}

          {p.cast.length > 0 && (
            <section id="casting" className={`${styles.anchor} ${styles.block}`}>
              <h2 className={styles.h2}>Casting</h2>
              <div className={styles.castRail}>
                {p.cast.slice(0, 16).map((c) => (
                  <Link key={`${c.id}-${c.character}`} href={`/actor/${c.id}`} className={styles.castCard}>
                    <span className={styles.castPhoto}>
                      {c.profileUrl ? (
                        <Image src={c.profileUrl} alt="" fill sizes="112px" style={{ objectFit: "cover" }} />
                      ) : (
                        <span className={styles.castInitial}>{c.name.charAt(0)}</span>
                      )}
                    </span>
                    <span className={styles.castName}>{c.name}</span>
                    <span className={styles.castRole}>{c.character}</span>
                  </Link>
                ))}
              </div>
            </section>
          )}

          <section className={styles.notesRow}>
            <RatingsCard
              tmdbAvg={series.voteAverage}
              tmdbCount={series.voteCount}
              friendsAvg={friendsAvg}
              communityRatings={communityRatings}
            />
            {p.isAuthenticated && <DetailCard detail={p.ratingDetail} />}
          </section>

          <AwardsAsync wikidataId={p.externalIds.wikidataId} sectionClassName={`${styles.card} ${styles.awards}`} titleClassName={styles.h3} />

          <section id="critiques" className={`${styles.anchor} ${styles.block}`}>
            <ReviewsBlock reviews={p.reviews} />
          </section>

          {p.similar.length > 0 && (
            <section id="similaires" className={`${styles.anchor} ${styles.block}`}>
              <PosterRail title="Séries similaires" items={p.similar} hrefBase="/series" />
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
