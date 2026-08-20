import { notFound } from "next/navigation";
import Image from "next/image";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import { fetchSeriesDetail, fetchSeriesLogo } from "@/lib/tmdb";
import FilmTopbar from "../../film/[id]/components/FilmTopbar";
import FilmTitleLogo from "../../film/[id]/components/FilmTitleLogo";
import SeriesActions from "./SeriesActions";
import SeasonTracker from "./SeasonTracker";
import RatingWidget from "../../film/[id]/components/RatingWidget";
import { saveSeriesRating, deleteSeriesRating } from "@/app/actions/series";
import filmStyles from "../../film/[id]/film.module.css";
import styles from "./series.module.css";
import { Rating } from "@/lib/rating-scale";

const STATUS_LABELS: Record<string, string> = {
  "Returning Series": "En cours",
  Ended: "Terminée",
  Canceled: "Annulée",
  "In Production": "En production",
  Planned: "Prévue",
};

export default async function SeriesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: idStr } = await params;
  const id = parseInt(idStr);
  if (isNaN(id)) notFound();

  const [session, series, logoUrl] = await Promise.all([
    getSession(),
    fetchSeriesDetail(id),
    fetchSeriesLogo(id),
  ]);

  if (!series) notFound();

  const [userSeries, watchedEpisodes, seasonRatings] = session
    ? await Promise.all([
        prisma.userSeries.findUnique({
          where: { userId_tmdbId: { userId: session.userId, tmdbId: id } },
        }),
        prisma.userEpisode.findMany({
          where: { userId: session.userId, seriesId: id },
          select: { seasonNumber: true },
        }),
        prisma.userSeason.findMany({
          where: { userId: session.userId, seriesId: id, rating: { not: null } },
          select: { seasonNumber: true, rating: true },
        }),
      ])
    : [null, [], []];

  // Progression : nb d'épisodes vus par saison + total
  const watchedBySeason: Record<number, number> = {};
  for (const e of watchedEpisodes) {
    watchedBySeason[e.seasonNumber] = (watchedBySeason[e.seasonNumber] ?? 0) + 1;
  }
  // Notes de saison, pour les afficher sans avoir à déplier la saison.
  const ratingBySeason: Record<number, number> = {};
  for (const r of seasonRatings) {
    if (r.rating != null) ratingBySeason[r.seasonNumber] = r.rating;
  }

  const totalWatched = watchedEpisodes.length;
  const globalPct =
    series.numberOfEpisodes > 0
      ? Math.round((totalWatched / series.numberOfEpisodes) * 100)
      : 0;

  const statusLabel = STATUS_LABELS[series.status] ?? series.status;

  return (
    <>
      {series.backdropUrl && (
        <div className={filmStyles.backdrop} style={{ backgroundImage: `url("${series.backdropUrl}")` }} />
      )}
      <div className={filmStyles.backdropOverlay} />

      <FilmTopbar fallbackHref="/series" />

      <div className={filmStyles.hero}>
        {/* Colonne gauche : poster + actions */}
        <div className={filmStyles.posterCol}>
          <div className={filmStyles.poster}>
            {series.posterUrl && (
              <Image src={series.posterUrl} alt={series.name} fill priority sizes="280px" style={{ objectFit: "cover" }} />
            )}
          </div>
          <SeriesActions
            tmdbId={id}
            initialWatchlist={userSeries?.watchlist ?? false}
            initialLiked={userSeries?.liked ?? false}
            isAuthenticated={!!session}
          />
        </div>

        {/* Colonne droite : métadonnées */}
        <div className={filmStyles.metaCol}>
          {series.genres.length > 0 && (
            <div className={filmStyles.genres}>
              {series.genres.map((g) => (
                <span key={g} className={filmStyles.genreTag}>{g}</span>
              ))}
            </div>
          )}

          <FilmTitleLogo
            logoUrl={logoUrl}
            title={series.name}
            titleClassName={filmStyles.movieTitle}
            logoClassName={filmStyles.movieTitleLogo}
          />

          <div className={filmStyles.scores}>
            <div className={`${filmStyles.scoreCard} ${filmStyles.scoreAccent}`}>
              <div className={`${filmStyles.scoreVal} ${filmStyles.scoreGold}`}>★ <Rating value={series.voteAverage} /></div>
              <div className={filmStyles.scoreLab}>Note TMDB</div>
            </div>
            <div className={filmStyles.scoreCard}>
              <div className={filmStyles.scoreVal}>{series.numberOfSeasons}</div>
              <div className={filmStyles.scoreLab}>Saison{series.numberOfSeasons > 1 ? "s" : ""}</div>
            </div>
            <div className={filmStyles.scoreCard}>
              <div className={filmStyles.scoreVal}>{series.numberOfEpisodes}</div>
              <div className={filmStyles.scoreLab}>Épisodes</div>
            </div>
            {statusLabel && (
              <div className={filmStyles.scoreCard}>
                <div className={filmStyles.scoreVal} style={{ fontSize: 18 }}>{statusLabel}</div>
                <div className={filmStyles.scoreLab}>Statut</div>
              </div>
            )}
          </div>

          {/* Note + avis — même bloc que la fiche film */}
          <RatingWidget
            tmdbId={id}
            initialRating={userSeries?.rating ?? 0}
            initialReview={userSeries?.review ?? ""}
            title={series.name}
            isAuthenticated={!!session}
            saveAction={saveSeriesRating}
            deleteAction={deleteSeriesRating}
          />

          {/* Progression globale de visionnage */}
          {session && totalWatched > 0 && (
            <div className={styles.progressBox}>
              <div className={styles.progressTop}>
                <span>Ma progression</span>
                <span>{totalWatched}/{series.numberOfEpisodes} épisodes · {globalPct}%</span>
              </div>
              <div className={styles.progressTrack}>
                <div className={styles.progressFill} style={{ width: `${globalPct}%` }} />
              </div>
            </div>
          )}

          {series.overview && (
            <div className={filmStyles.section}>
              <div className={filmStyles.sectionTitle}>Synopsis</div>
              <p className={filmStyles.synopsis}>{series.overview}</p>
            </div>
          )}

          {/* Suivi par saison / épisode */}
          {series.seasons.length > 0 && (
            <div className={filmStyles.section}>
              <div className={filmStyles.sectionTitle}>Épisodes</div>
              <SeasonTracker
                seriesId={id}
                seasons={series.seasons}
                watchedBySeason={watchedBySeason}
                ratingBySeason={ratingBySeason}
                isAuthenticated={!!session}
              />
            </div>
          )}

          {series.networks.length > 0 && (
            <div className={filmStyles.section}>
              <div className={filmStyles.sectionTitle}>Diffusion</div>
              <div className={filmStyles.factVal}>{series.networks.join(", ")}</div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
