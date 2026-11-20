import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getSession } from "@/lib/session";
import { getUserWatchProviders } from "@/lib/user-settings";
import { BASE_OPEN_GRAPH } from "@/lib/site";
import { prisma } from "@/lib/db";
import { fetchSeriesBundle, fetchReviews, formatRuntime } from "@/lib/tmdb";
import { buildReviewCards } from "@/lib/reviews";
import type { AssistantState } from "@/lib/rating-assistant";
import RemovedTitle from "../../components/RemovedTitle";
import { CrewLinks } from "../../components/sheet/SheetParts";
import SeriesSheet from "./SeriesSheet";

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

/** Coupe un synopsis à la longueur qu'affichent les aperçus, sans trancher un mot. */
function excerpt(text: string, max = 160): string {
  if (text.length <= max) return text;
  const cut = text.lastIndexOf(" ", max - 1);
  return `${text.slice(0, cut > 0 ? cut : max)}…`;
}

/** Titre et aperçu de lien de la fiche — voir la fiche film pour le pourquoi. */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const id = parseInt((await params).id);
  const bundle = Number.isNaN(id) ? null : await fetchSeriesBundle(id);
  if (!bundle) return {};

  const series = bundle.detail;
  const title = series.year ? `${series.name} (${series.year})` : series.name;
  const description = series.overview ? excerpt(series.overview) : `${series.name} sur MovieTracker.`;
  return {
    title,
    description,
    openGraph: {
      ...BASE_OPEN_GRAPH,
      title,
      description,
      images: series.posterUrl ? [{ url: series.posterUrl, alt: series.name }] : undefined,
    },
    twitter: { card: "summary" },
  };
}

export default async function SeriesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: idStr } = await params;
  const id = parseInt(idStr);
  if (isNaN(id)) notFound();

  // Un seul appel TMDB pour toute la fiche (append_to_response) au lieu des
  // six requêtes indépendantes d'avant.
  // Les avis restent hors du bundle : il est demandé en `fr-FR`, langue dans
  // laquelle TMDB n'a quasiment aucun avis.
  const [session, bundle, tmdbReviews] = await Promise.all([
    getSession(),
    fetchSeriesBundle(id),
    fetchReviews("tv", id),
  ]);

  // Inconnue de TMDB : supprimée ou fusionnée si l'application la connaît
  // encore, sinon vraie 404 (décidé par RemovedTitle).
  if (!bundle) return <RemovedTitle kind="tv" tmdbId={id} />;

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

  const [userSeries, watchedEpisodes, seasonRatings, myProviders, detail] = session
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
        getUserWatchProviders(session.userId),
        prisma.ratingDetail.findUnique({
          where: { userId_media_tmdbId: { userId: session.userId, media: "tv", tmdbId: id } },
          select: { state: true, score: true },
        }),
      ])
    : [null, [], [], [], null];

  // Avis des personnes suivies, avec une note et/ou un texte (un avis vide est
  // stocké comme ""), comme sur la fiche film.
  const friendSeries = session
    ? await prisma.userSeries.findMany({
        where: {
          tmdbId: id,
          user: { followers: { some: { followerId: session.userId } } },
          OR: [{ rating: { not: null } }, { review: { not: "" } }],
        },
        select: {
          rating: true,
          review: true,
          updatedAt: true,
          user: { select: { id: true, name: true, avatarUrl: true } },
        },
        orderBy: { updatedAt: "desc" },
      })
    : [];
  const reviews = buildReviewCards(friendSeries, tmdbReviews);

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

  // Fiche technique, dans l'ordre de lecture
  const facts = [
    authors.length > 0 && { k: authorLabel, v: <CrewLinks people={authors} /> },
    credits.writers.length > 0 && { k: "Scénario", v: <CrewLinks people={credits.writers.slice(0, 3)} /> },
    series.firstAirDate && { k: "Première diffusion", v: formatDate(series.firstAirDate) },
    series.lastAirDate && {
      k: series.inProduction ? "Dernier épisode" : "Dernière diffusion",
      v: formatDate(series.lastAirDate),
    },
    series.nextEpisode?.airDate && {
      k: "Prochain épisode",
      v: `S${series.nextEpisode.seasonNumber}E${series.nextEpisode.episodeNumber} — ${formatDate(series.nextEpisode.airDate)}`,
    },
    typeLabel && { k: "Format", v: typeLabel },
    series.episodeRunTime && { k: "Durée d'un épisode", v: formatRuntime(series.episodeRunTime) },
    totalMinutes && { k: "Durée totale", v: `${Math.round(totalMinutes / 60)}h de programme` },
    langLabel && { k: "Langue", v: langLabel },
    series.productionCountries.length > 0 && { k: "Pays", v: series.productionCountries.slice(0, 2).join(", ") },
    series.networks.length > 0 && { k: "Diffuseur", v: series.networks.slice(0, 2).map((n) => n.name).join(", ") },
    showOriginalName && { k: "Titre original", v: series.originalName },
  ].filter(Boolean) as { k: string; v: React.ReactNode }[];

  return (
    <SeriesSheet
      series={series}
      isAuthenticated={!!session}
      logoUrl={logoUrl}
      certification={certification}
      video={video}
      statusLabel={statusLabel}
      authorName={authors[0]?.name ?? null}
      facts={facts}
      externalIds={externalIds}
      cast={credits.cast}
      keywords={keywords}
      providers={providers}
      myProviders={myProviders}
      reviews={reviews}
      friendRatings={friendSeries}
      similar={similar}
      userSeries={userSeries}
      totalWatched={totalWatched}
      globalPct={globalPct}
      watchedBySeason={watchedBySeason}
      ratingBySeason={ratingBySeason}
      ratingDetail={detail ? { state: detail.state as AssistantState, score: detail.score } : null}
    />
  );
}
