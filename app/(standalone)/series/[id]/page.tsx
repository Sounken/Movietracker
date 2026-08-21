import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import { fetchSeriesBundle, formatRuntime } from "@/lib/tmdb";
import FilmTopbar from "../../film/[id]/components/FilmTopbar";
import FilmTitleLogo from "../../film/[id]/components/FilmTitleLogo";
import CastGrid from "../../film/[id]/components/CastGrid";
import SimilarFilms from "../../film/[id]/components/SimilarFilms";
import WatchProvidersSection from "../../components/WatchProvidersSection";
import AwardsSection from "../../components/AwardsSection";
import TrailerSection from "../../components/TrailerSection";
import ExternalLinks from "../../components/ExternalLinks";
import { fetchAwards } from "@/lib/awards";
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
  Pilot: "Pilote",
};

// `type` TMDB : la nature du programme, utile pour distinguer une mini-série
// d'une série au long cours ou d'une émission.
const TYPE_LABELS: Record<string, string> = {
  Scripted: "Fiction",
  Miniseries: "Mini-série",
  Documentary: "Documentaire",
  Reality: "Télé-réalité",
  "Talk Show": "Talk-show",
  News: "Information",
  Video: "Vidéo",
};

const LANG_NAMES: Record<string, string> = {
  en: "Anglais", fr: "Français", es: "Espagnol", de: "Allemand", it: "Italien",
  ja: "Japonais", ko: "Coréen", zh: "Chinois", pt: "Portugais", ru: "Russe",
  ar: "Arabe", hi: "Hindi", nl: "Néerlandais", sv: "Suédois", da: "Danois",
};

const DATE_FMT = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

function formatDate(iso: string): string {
  if (!iso) return "";
  const d = new Date(`${iso}T00:00:00`);
  return Number.isNaN(d.getTime()) ? iso : DATE_FMT.format(d);
}

export default async function SeriesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: idStr } = await params;
  const id = parseInt(idStr);
  if (isNaN(id)) notFound();

  // Un seul appel TMDB pour toute la fiche (append_to_response) au lieu des
  // six requêtes indépendantes d'avant.
  const [session, bundle] = await Promise.all([getSession(), fetchSeriesBundle(id)]);

  if (!bundle) notFound();

  const {
    detail: series,
    credits,
    similar,
    providers,
    externalIds,
    keywords,
    video,
    certification,
    logoUrl,
  } = bundle;

  // Distinctions réelles (Wikidata) : dépend de external_ids, donc en second
  // temps. Un échec renvoie une liste vide, la fiche s'affiche quand même.
  const awards = externalIds.wikidataId ? await fetchAwards(externalIds.wikidataId) : [];

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
  const typeLabel = TYPE_LABELS[series.type] ?? series.type;
  const langLabel = LANG_NAMES[series.originalLanguage] ?? series.originalLanguage?.toUpperCase();
  const showOriginalName = series.originalName && series.originalName !== series.name;

  // Temps total que représente la série, si TMDB connaît la durée d'un épisode.
  const totalMinutes = series.episodeRunTime
    ? series.episodeRunTime * series.numberOfEpisodes
    : null;

  // Les créateurs priment sur les réalisateurs : sur une série, c'est le
  // showrunner qui signe l'œuvre, pas le réalisateur d'un épisode donné.
  const authors = series.createdBy.length > 0 ? series.createdBy : credits.directors;
  const authorLabel = series.createdBy.length > 0 ? "Création" : "Réalisation";

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
          {(series.genres.length > 0 || certification) && (
            <div className={filmStyles.genres}>
              {certification && (
                <span className={styles.certification} title="Classification d'âge">
                  {certification}
                </span>
              )}
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

          {showOriginalName && (
            <div className={styles.originalName}>{series.originalName}</div>
          )}

          {series.tagline && <div className={styles.tagline}>{series.tagline}</div>}

          <div className={filmStyles.scores}>
            <div className={`${filmStyles.scoreCard} ${filmStyles.scoreAccent}`}>
              <div className={`${filmStyles.scoreVal} ${filmStyles.scoreGold}`}>★ <Rating value={series.voteAverage} /></div>
              <div className={filmStyles.scoreLab}>Note TMDB</div>
            </div>
            <div className={filmStyles.scoreCard}>
              <div className={filmStyles.scoreVal}>{series.voteCount.toLocaleString("fr")}</div>
              <div className={filmStyles.scoreLab}>Votes</div>
            </div>
            <div className={filmStyles.scoreCard}>
              <div className={filmStyles.scoreVal}>{series.numberOfSeasons}</div>
              <div className={filmStyles.scoreLab}>Saison{series.numberOfSeasons > 1 ? "s" : ""}</div>
            </div>
            <div className={filmStyles.scoreCard}>
              <div className={filmStyles.scoreVal}>{series.numberOfEpisodes}</div>
              <div className={filmStyles.scoreLab}>Épisodes</div>
            </div>
            {series.episodeRunTime && (
              <div className={filmStyles.scoreCard}>
                <div className={filmStyles.scoreVal}>{series.episodeRunTime}<span className={styles.unit}>min</span></div>
                <div className={filmStyles.scoreLab}>Par épisode</div>
              </div>
            )}
            {statusLabel && (
              <div className={filmStyles.scoreCard}>
                {/* scoreValText : même hauteur de ligne que les chiffres, donc
                    le libellé « Statut » s'aligne sur les autres. */}
                <div className={`${filmStyles.scoreVal} ${filmStyles.scoreValText}`}>{statusLabel}</div>
                <div className={filmStyles.scoreLab}>Statut</div>
              </div>
            )}
            {series.year && (
              <div className={filmStyles.scoreCard}>
                <div className={filmStyles.scoreVal}>{series.year}</div>
                <div className={filmStyles.scoreLab}>Début</div>
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

          {video && (
            <TrailerSection
              video={video}
              title={series.name}
              sectionClassName={filmStyles.section}
              titleClassName={filmStyles.sectionTitle}
            />
          )}

          <WatchProvidersSection
            providers={providers}
            sectionClassName={filmStyles.section}
            titleClassName={filmStyles.sectionTitle}
          />

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

          {/* ——— Fiche technique, calquée sur celle des films ——— */}
          <div className={filmStyles.section}>
            <div className={filmStyles.sectionTitle}>Fiche technique</div>
            <div className={filmStyles.facts}>
              {authors.length > 0 && (
                <div className={filmStyles.fact}>
                  <div className={filmStyles.factLab}>{authorLabel}</div>
                  <div className={filmStyles.factVal}>
                    {authors.map((a, i) => (
                      <span key={a.id}>
                        {i > 0 && ", "}
                        <Link href={`/actor/${a.id}`} className={filmStyles.crewLink}>{a.name}</Link>
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {credits.writers.length > 0 && (
                <div className={filmStyles.fact}>
                  <div className={filmStyles.factLab}>Scénario</div>
                  <div className={filmStyles.factVal}>
                    {credits.writers.map((w, i) => (
                      <span key={w.id}>
                        {i > 0 && ", "}
                        <Link href={`/actor/${w.id}`} className={filmStyles.crewLink}>{w.name}</Link>
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {series.firstAirDate && (
                <div className={filmStyles.fact}>
                  <div className={filmStyles.factLab}>Première diffusion</div>
                  <div className={filmStyles.factVal}>{formatDate(series.firstAirDate)}</div>
                </div>
              )}
              {series.lastAirDate && (
                <div className={filmStyles.fact}>
                  <div className={filmStyles.factLab}>
                    {series.inProduction ? "Dernier épisode diffusé" : "Dernière diffusion"}
                  </div>
                  <div className={filmStyles.factVal}>{formatDate(series.lastAirDate)}</div>
                </div>
              )}
              {series.nextEpisode?.airDate && (
                <div className={filmStyles.fact}>
                  <div className={filmStyles.factLab}>Prochain épisode</div>
                  <div className={`${filmStyles.factVal} ${styles.nextEpisode}`}>
                    S{series.nextEpisode.seasonNumber}E{series.nextEpisode.episodeNumber}
                    {series.nextEpisode.name && ` · ${series.nextEpisode.name}`}
                    {" — "}
                    {formatDate(series.nextEpisode.airDate)}
                  </div>
                </div>
              )}
              {typeLabel && (
                <div className={filmStyles.fact}>
                  <div className={filmStyles.factLab}>Format</div>
                  <div className={filmStyles.factVal}>{typeLabel}</div>
                </div>
              )}
              {series.episodeRunTime && (
                <div className={filmStyles.fact}>
                  <div className={filmStyles.factLab}>Durée d&apos;un épisode</div>
                  <div className={filmStyles.factVal}>{formatRuntime(series.episodeRunTime)}</div>
                </div>
              )}
              {totalMinutes && (
                <div className={filmStyles.fact}>
                  <div className={filmStyles.factLab}>Durée totale</div>
                  <div className={filmStyles.factVal}>
                    {Math.round(totalMinutes / 60)}h de programme
                  </div>
                </div>
              )}
              {langLabel && (
                <div className={filmStyles.fact}>
                  <div className={filmStyles.factLab}>Langue originale</div>
                  <div className={filmStyles.factVal}>{langLabel}</div>
                </div>
              )}
              {series.productionCountries.length > 0 && (
                <div className={filmStyles.fact}>
                  <div className={filmStyles.factLab}>Pays d&apos;origine</div>
                  <div className={filmStyles.factVal}>
                    {series.productionCountries.slice(0, 3).join(", ")}
                  </div>
                </div>
              )}
              {series.genres.length > 0 && (
                <div className={filmStyles.fact}>
                  <div className={filmStyles.factLab}>Genres</div>
                  <div className={filmStyles.factVal}>{series.genres.join(", ")}</div>
                </div>
              )}
              <div className={filmStyles.fact}>
                <div className={filmStyles.factLab}>Popularité</div>
                <div className={filmStyles.factVal}>{series.popularity}</div>
              </div>
              {certification && (
                <div className={filmStyles.fact}>
                  <div className={filmStyles.factLab}>Classification</div>
                  <div className={filmStyles.factVal}>{certification}</div>
                </div>
              )}
            </div>

            <ExternalLinks ids={externalIds} homepage={series.homepage} />
          </div>

          <AwardsSection
            awards={awards}
            sectionClassName={filmStyles.section}
            titleClassName={filmStyles.sectionTitle}
          />

          {credits.cast.length > 0 && <CastGrid cast={credits.cast} />}

          {keywords.length > 0 && (
            <div className={filmStyles.section}>
              <div className={filmStyles.sectionTitle}>Thèmes</div>
              <div className={filmStyles.awardTags}>
                {keywords.slice(0, 18).map((k) => (
                  <span key={k} className={filmStyles.awardTag}>{k}</span>
                ))}
              </div>
            </div>
          )}

          {series.networks.length > 0 && (
            <div className={filmStyles.section}>
              <div className={filmStyles.sectionTitle}>Diffuseurs</div>
              <div className={filmStyles.companies}>
                {series.networks.map((n) => (
                  <div key={n.id} className={styles.network}>
                    {n.logoUrl && (
                      <Image
                        src={n.logoUrl}
                        alt=""
                        width={20}
                        height={20}
                        className={filmStyles.companyLogo}
                      />
                    )}
                    {n.name}
                  </div>
                ))}
              </div>
            </div>
          )}

          {series.productionCompanies.length > 0 && (
            <div className={filmStyles.section}>
              <div className={filmStyles.sectionTitle}>Sociétés de production</div>
              <div className={filmStyles.companies}>
                {series.productionCompanies.map((c) => (
                  <Link key={c.id} href={`/company/${c.id}`} className={filmStyles.companyTag}>
                    {c.logoUrl && (
                      <Image
                        src={c.logoUrl}
                        alt=""
                        width={20}
                        height={20}
                        className={filmStyles.companyLogo}
                      />
                    )}
                    {c.name}
                  </Link>
                ))}
              </div>
            </div>
          )}

          {similar.length > 0 && (
            <SimilarFilms films={similar} title="Séries similaires" hrefBase="/series" />
          )}
        </div>
      </div>
    </>
  );
}
