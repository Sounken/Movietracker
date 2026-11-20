import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getSession } from "@/lib/session";
import { getUserWatchProviders } from "@/lib/user-settings";
import { BASE_OPEN_GRAPH } from "@/lib/site";
import { prisma } from "@/lib/db";
import { fetchFilmDetail, fetchFilmCredits, fetchSimilarFilms, fetchFilmKeywords, fetchFilmLogo, fetchFilmCollection, fetchWatchProviders, fetchExternalIds, fetchFilmExtras, fetchReviews } from "@/lib/tmdb";
import { buildReviewCards } from "@/lib/reviews";
import type { AssistantState } from "@/lib/rating-assistant";
import { fetchFilmRelease, parisToday } from "@/lib/releases";
import { formatWatchDate } from "@/lib/watch-date";
import RemovedTitle from "../../components/RemovedTitle";
import FilmNocturne from "./nocturne/FilmNocturne";

const LANG_NAMES: Record<string, string> = {
  en: "Anglais", fr: "Français", es: "Espagnol", de: "Allemand", it: "Italien",
  ja: "Japonais", ko: "Coréen", zh: "Chinois", pt: "Portugais", ru: "Russe",
  ar: "Arabe", hi: "Hindi", nl: "Néerlandais", sv: "Suédois", da: "Danois",
};

/** Coupe un synopsis à la longueur qu'affichent les aperçus, sans trancher un mot. */
function excerpt(text: string, max = 160): string {
  if (text.length <= max) return text;
  const cut = text.lastIndexOf(" ", max - 1);
  return `${text.slice(0, cut > 0 ? cut : max)}…`;
}

/**
 * Titre et aperçu de lien de la fiche.
 *
 * La fiche reste fermée aux moteurs (`robots.ts`) : ces balises servent
 * surtout quand un membre partage le lien à un ami, où l'affiche et le
 * synopsis donnent envie de cliquer. Même appel TMDB que la page, que Next.js
 * ne fait qu'une fois par requête.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const id = parseInt((await params).id);
  const film = Number.isNaN(id) ? null : await fetchFilmDetail(id);
  if (!film) return {};

  const title = film.year ? `${film.title} (${film.year})` : film.title;
  const description = film.overview ? excerpt(film.overview) : `${film.title} sur MovieTracker.`;
  return {
    title,
    description,
    openGraph: {
      ...BASE_OPEN_GRAPH,
      title,
      description,
      images: film.posterUrl ? [{ url: film.posterUrl, alt: film.title }] : undefined,
    },
    twitter: { card: "summary" },
  };
}

export default async function FilmPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: idStr } = await params;
  const id = parseInt(idStr);
  if (isNaN(id)) notFound();

  const [session, film, credits, similar, keywords, logoUrl, providers, externalIds, extras, tmdbReviews, release] =
    await Promise.all([
      getSession(),
      fetchFilmDetail(id),
      fetchFilmCredits(id),
      fetchSimilarFilms(id),
      fetchFilmKeywords(id),
      fetchFilmLogo(id),
      fetchWatchProviders("movie", id),
      fetchExternalIds("movie", id),
      fetchFilmExtras(id),
      fetchReviews("movie", id),
      fetchFilmRelease(id),
    ]);

  // Inconnu de TMDB : supprimé ou fusionné si l'application le connaît
  // encore, sinon vraie 404 (décidé par RemovedTitle).
  if (!film) return <RemovedTitle kind="movie" tmdbId={id} />;

  /**
   * Second temps : les films de la saga, qui dépendent de `film.collectionId`
   * et ne peuvent donc pas rejoindre le lot précédent.
   *
   * Les distinctions Wikidata étaient elles aussi attendues ici. Elles sont
   * désormais différées dans un `<Suspense>` (cf. AwardsAsync) : c'était le
   * poste le plus lourd de la page, ~1,2 s de médiane, et il bloquait tout le
   * reste — y compris pour les films qui n'ont aucune distinction à montrer.
   */
  const collection = film.collectionId ? await fetchFilmCollection(film.collectionId) : [];

  // Films de la saga, hors film courant. `recommendations` en oublie une
  // partie — sur Star Wars, plusieurs épisodes n'apparaissaient pas.
  const sagaFilms = collection.filter((f) => f.id !== film.id);

  // Pas de doublon entre les deux blocs : ce qui est déjà dans la saga sort
  // des « films similaires ».
  const sagaIds = new Set(sagaFilms.map((f) => f.id));
  const similarFilms = similar.filter((s) => !sagaIds.has(s.id));

  const [userFilm, userLists, listsWithFilmRaw, friendFilms, myProviders, reminder, detail] = session
    ? await Promise.all([
        prisma.userFilm.findUnique({
          where: { userId_tmdbId: { userId: session.userId, tmdbId: id } },
        }),
        prisma.userList.findMany({
          where: { userId: session.userId },
          select: { id: true, name: true, emoji: true },
          orderBy: { createdAt: "asc" },
        }),
        prisma.userListFilm.findMany({
          where: { tmdbId: id, list: { userId: session.userId } },
          select: { listId: true },
        }),
        // UserFilms de ce film dont l'auteur fait partie des personnes que je suis,
        // avec une note et/ou un avis (les avis sont stockés comme "" quand vides).
        prisma.userFilm.findMany({
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
        }),
        getUserWatchProviders(session.userId),
        prisma.releaseReminder.findUnique({
          where: { userId_tmdbId: { userId: session.userId, tmdbId: id } },
          select: { id: true },
        }),
        prisma.ratingDetail.findUnique({
          where: { userId_media_tmdbId: { userId: session.userId, media: "movie", tmdbId: id } },
          select: { state: true, score: true },
        }),
      ])
    : [null, [], [], [], [], null, null];

  // « Me prévenir » n'a de sens que si la sortie française est à venir.
  const upcomingRelease = release && release.date > parisToday() ? release : null;

  const listsWithFilm = (listsWithFilmRaw as { listId: string }[]).map((r) => r.listId);
  const reviews = buildReviewCards(friendFilms, tmdbReviews);

  const langLabel = LANG_NAMES[film.originalLanguage] ?? film.originalLanguage?.toUpperCase();

  return (
    <FilmNocturne
      userId={session?.userId ?? null}
      film={film}
      logoUrl={logoUrl}
      certification={extras.certification ?? null}
      video={extras.video ?? null}
      directors={credits.directors}
      writers={credits.writers}
      cast={credits.cast}
      keywords={keywords}
      langLabel={langLabel}
      providers={providers}
      myProviders={myProviders}
      externalIds={externalIds}
      reviews={reviews}
      friendRatings={friendFilms}
      similarFilms={similarFilms}
      sagaFilms={sagaFilms}
      sagaName={film.collectionName ?? null}
      userFilm={userFilm}
      userLists={userLists}
      listsWithFilm={listsWithFilm}
      reminder={
        upcomingRelease
          ? {
              on: Boolean(reminder),
              label: `Me prévenir • ${upcomingRelease.kind === "digital" ? "en numérique" : "au cinéma"} le ${formatWatchDate(`${upcomingRelease.date}T00:00:00Z`)}`,
            }
          : null
      }
      ratingDetail={detail ? { state: detail.state as AssistantState, score: detail.score } : null}
    />
  );
}
