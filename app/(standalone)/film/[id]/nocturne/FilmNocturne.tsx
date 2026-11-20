import Link from "next/link";
import Image from "next/image";
import { prisma } from "@/lib/db";
import { Rating } from "@/lib/rating-scale";
import { formatMoney, formatRuntime, type TmdbCastMember, type TmdbFilmCard, type TmdbFilmDetail } from "@/lib/tmdb";
import type { ReviewCard } from "@/lib/reviews";
import type { AssistantState } from "@/lib/rating-assistant";
import ReminderToggle from "@/app/(app)/components/ReminderToggle";
import WatchProvidersSection from "../../../components/WatchProvidersSection";
import TrailerSection from "../../../components/TrailerSection";
import AwardsAsync from "../../../components/AwardsAsync";
import ExternalLinks from "../../../components/ExternalLinks";
import { CrewLinks, DetailCard, PosterRail, RatingsCard, type Crew } from "./parts";
import { BackButton, HeroActions, MyRating, ReviewsBlock, SectionTabs } from "./FilmNocturneClient";
import styles from "./film-nocturne.module.css";

export type FilmNocturneProps = {
  /** null pour un visiteur non connecté (lien partagé). */
  userId: string | null;
  film: TmdbFilmDetail;
  logoUrl: string | null;
  certification: string | null;
  video: Parameters<typeof TrailerSection>[0]["video"] | null;
  directors: Crew[];
  writers: Crew[];
  cast: TmdbCastMember[];
  keywords: string[];
  langLabel: string | undefined;
  providers: Parameters<typeof WatchProvidersSection>[0]["providers"];
  myProviders: Parameters<typeof WatchProvidersSection>[0]["mine"];
  externalIds: Parameters<typeof ExternalLinks>[0]["ids"] & { wikidataId: string | null };
  reviews: ReviewCard[];
  friendRatings: { rating: number | null; user: { id: string; name: string | null; avatarUrl: string | null } }[];
  similarFilms: TmdbFilmCard[];
  sagaFilms: TmdbFilmCard[];
  sagaName: string | null;
  userFilm: { rating: number | null; review: string | null; watchlist: boolean; liked: boolean; watched: boolean } | null;
  userLists: { id: string; name: string; emoji: string }[];
  listsWithFilm: string[];
  reminder: { label: string; on: boolean } | null;
  /** Mes notes détaillées (« M'aider à noter »), si je les ai enregistrées. */
  ratingDetail: { state: AssistantState; score: number } | null;
};

const SECTIONS = [
  { id: "apercu", label: "Aperçu" },
  { id: "casting", label: "Casting" },
  { id: "critiques", label: "Critiques" },
  { id: "distinctions", label: "Distinctions" },
  { id: "similaires", label: "Similaires" },
];

/**
 * Fiche film, direction Nocturne. Reprend le hero de l'accueil — même cadre
 * arrondi, en-tête global posé sur l'image (`data-hero`) — et range tout ce que
 * l'utilisateur fait (noter, cocher vu, écrire, proposer) dans la colonne de
 * l'affiche, collante. La note reste aux étoiles, comme sur la fiche actuelle.
 */
export default async function FilmNocturne(p: FilmNocturneProps) {
  const { film } = p;

  const isAuthenticated = p.userId !== null;
  const community = await prisma.userFilm.findMany({
    where: { tmdbId: film.id, rating: { not: null } },
    select: { rating: true },
  });

  const avg = (xs: number[]) => (xs.length ? xs.reduce((s, v) => s + v, 0) / xs.length : null);
  const communityRatings = community.map((c) => c.rating!);
  const friendRated = p.friendRatings.filter((f) => f.rating !== null);
  const friendsAvg = avg(friendRated.map((f) => f.rating!));

  // Retour sur investissement : recettes rapportées au budget
  const roi = film.budget > 0 && film.revenue > 0 ? Math.round(((film.revenue - film.budget) / film.budget) * 100) : null;

  const facts = [
    p.directors.length > 0 && { k: "Réalisation", v: <CrewLinks people={p.directors} /> },
    p.writers.length > 0 && { k: "Scénario", v: <CrewLinks people={p.writers.slice(0, 3)} /> },
    film.releaseDate && {
      k: "Sortie",
      v: new Date(film.releaseDate).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" }),
    },
    film.runtime && { k: "Durée", v: formatRuntime(film.runtime) },
    film.productionCountries.length > 0 && { k: "Pays", v: film.productionCountries.slice(0, 2).join(", ") },
    p.langLabel && { k: "Langue", v: p.langLabel },
    film.originalTitle && film.originalTitle !== film.title && { k: "Titre original", v: film.originalTitle },
    film.budget > 0 && { k: "Budget", v: formatMoney(film.budget) },
    film.revenue > 0 && {
      k: "Recettes",
      v: <span className={film.budget > 0 && film.revenue < film.budget ? styles.factNeg : styles.factPos}>{formatMoney(film.revenue)}</span>,
    },
    roi !== null && {
      k: "ROI",
      v: <span className={roi > 0 ? styles.factPos : styles.factNeg}>{roi > 0 ? "+" : ""}{roi} %</span>,
    },
  ].filter(Boolean) as { k: string; v: React.ReactNode }[];

  // Onglets des seules sections présentes sur cette fiche
  const sections = SECTIONS.filter(
    (s) =>
      (s.id !== "casting" || p.cast.length > 0) &&
      (s.id !== "distinctions" || p.externalIds.wikidataId) &&
      (s.id !== "similaires" || p.similarFilms.length + p.sagaFilms.length > 0),
  );

  return (
    <div className={styles.page} data-hero>
      {/* ——— Hero ——— */}
      <section className={styles.hero}>
        {film.backdropUrl && (
          <div className={styles.kb}>
            <Image src={film.backdropUrl} alt="" fill priority sizes="100vw" style={{ objectFit: "cover" }} />
          </div>
        )}
        <div className={styles.veil} />

        <div className={styles.heroText}>
          <BackButton className={styles.back} />
          <div className={styles.kicker}>
            {p.certification && <span className={styles.cert}>{p.certification}</span>}
            {film.genres.slice(0, 3).join(" • ")}
          </div>
          {p.logoUrl ? (
            <Image src={p.logoUrl} alt={film.title} width={0} height={0} sizes="560px" className={styles.logo} priority />
          ) : (
            <h1 className={styles.title} style={{ fontSize: film.title.length > 18 ? 64 : 104 }}>{film.title}</h1>
          )}
          <div className={styles.meta}>
            {film.year && <span>{film.year}</span>}
            {film.runtime && <span>{formatRuntime(film.runtime)}</span>}
            {p.directors[0] && <span>de {p.directors[0].name}</span>}
            {film.voteAverage > 0 && (
              <span className={styles.score}>
                ★ <Rating value={film.voteAverage} />
                <span className={styles.scoreSub}>TMDB</span>
              </span>
            )}
          </div>
          <HeroActions
            tmdbId={film.id}
            title={film.title}
            hasTrailer={Boolean(p.video)}
            initialWatchlist={p.userFilm?.watchlist ?? false}
            initialLiked={p.userFilm?.liked ?? false}
            watched={p.userFilm?.watched ?? false}
            isAuthenticated={isAuthenticated}
            userLists={p.userLists}
            listsWithFilm={p.listsWithFilm}
          />
        </div>

        <div className={styles.whereCol}>
          {p.reminder && (
            <div className={styles.glass}>
              <ReminderToggle tmdbId={film.id} initial={p.reminder.on} isAuthenticated={isAuthenticated} label={p.reminder.label} />
            </div>
          )}
          <WatchProvidersSection
            providers={p.providers}
            mine={p.myProviders}
            sectionClassName={`${styles.glass} ${styles.where}`}
            titleClassName={styles.glassTitle}
            compact
          />
        </div>
      </section>

      {/* ——— Corps : colonne de l'affiche + contenu ——— */}
      <div className={styles.body}>
        <aside className={styles.side}>
          <div className={styles.poster}>
            {film.posterUrl && <Image src={film.posterUrl} alt={film.title} fill sizes="320px" priority style={{ objectFit: "cover" }} />}
          </div>

          <MyRating
            tmdbId={film.id}
            title={film.title}
            initialRating={p.userFilm?.rating ?? 0}
            initialReview={p.userFilm?.review ?? ""}
            isAuthenticated={isAuthenticated}
            initialDetail={p.ratingDetail?.state ?? null}
          />

          {/* Écrans étroits : le hero n'a plus la place pour « Où regarder »,
              la carte descend dans la colonne. */}
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

          {/* Aperçu */}
          <section id="apercu" className={`${styles.anchor} ${styles.overview}`}>
            <div className={styles.synopsisCol}>
              <div className={styles.eyebrow}>Synopsis</div>
              <p className={styles.synopsis}>{film.overview || "Aucun synopsis disponible."}</p>
              {p.keywords.length > 0 && (
                <div className={styles.chips}>
                  {p.keywords.slice(0, 6).map((k) => (
                    <span key={k} className={styles.chip}>{k}</span>
                  ))}
                </div>
              )}
              {/* La bande-annonce occupe la colonne du synopsis : sans elle, un
                  synopsis court laissait un grand vide face à la fiche
                  technique. */}
              {p.video && (
                <div id="bande-annonce" className={`${styles.anchor} ${styles.trailer}`}>
                  <TrailerSection video={p.video} title={film.title} sectionClassName={styles.block} titleClassName={styles.eyebrow} />
                </div>
              )}
            </div>
            <div className={`${styles.card} ${styles.facts}`}>
              {facts.map((f) => (
                <div key={f.k} className={styles.fact}>
                  <span className={styles.factK}>{f.k}</span>
                  <span className={styles.factV}>{f.v}</span>
                </div>
              ))}
              <ExternalLinks ids={p.externalIds} />
            </div>
          </section>

          {/* Casting */}
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

          {/* Les notes + mes notes détaillées */}
          <section className={styles.notesRow}>
            <RatingsCard
              tmdbAvg={film.voteAverage}
              tmdbCount={film.voteCount}
              friendsAvg={friendsAvg}
              communityRatings={communityRatings}
            />
            {isAuthenticated && <DetailCard detail={p.ratingDetail} />}
          </section>

          {/* Critiques */}
          <section id="critiques" className={`${styles.anchor} ${styles.block}`}>
            <ReviewsBlock reviews={p.reviews} />
          </section>

          {/* Distinctions + similaires */}
          <section id="distinctions" className={`${styles.anchor} ${styles.awardsRow}`}>
            <AwardsAsync wikidataId={p.externalIds.wikidataId} sectionClassName={`${styles.card} ${styles.awards}`} titleClassName={styles.h3} />
          </section>

          <section id="similaires" className={`${styles.anchor} ${styles.block}`}>
            {p.sagaFilms.length > 0 && <PosterRail title={p.sagaName || "La saga"} items={p.sagaFilms} hrefBase="/film" />}
            {p.similarFilms.length > 0 && <PosterRail title="Films similaires" items={p.similarFilms} hrefBase="/film" />}
          </section>
        </div>
      </div>
    </div>
  );
}
