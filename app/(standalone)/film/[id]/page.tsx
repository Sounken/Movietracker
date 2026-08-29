import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import { saveRating, deleteRating } from "@/app/actions/film";
import { fetchFilmDetail, fetchFilmCredits, fetchSimilarFilms, fetchFilmKeywords, fetchFilmLogo, fetchFilmCollection, fetchWatchProviders, fetchExternalIds, fetchFilmExtras, formatMoney, formatRuntime } from "@/lib/tmdb";
import WatchProvidersSection from "../../components/WatchProvidersSection";
import AwardsSection from "../../components/AwardsSection";
import TrailerSection from "../../components/TrailerSection";
import ExternalLinks from "../../components/ExternalLinks";
import { fetchAwards } from "@/lib/awards";
import FilmTopbar from "./components/FilmTopbar";
import FilmTitleLogo from "./components/FilmTitleLogo";
import PosterActions from "./components/PosterActions";
import RatingWidget from "./components/RatingWidget";
import CastGrid from "./components/CastGrid";
import SimilarFilms from "./components/SimilarFilms";
import FriendReviews from "./components/FriendReviews";
import styles from "./film.module.css";
import { Rating } from "@/lib/rating-scale";

const LANG_NAMES: Record<string, string> = {
  en: "Anglais", fr: "Français", es: "Espagnol", de: "Allemand", it: "Italien",
  ja: "Japonais", ko: "Coréen", zh: "Chinois", pt: "Portugais", ru: "Russe",
  ar: "Arabe", hi: "Hindi", nl: "Néerlandais", sv: "Suédois", da: "Danois",
};

export default async function FilmPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: idStr } = await params;
  const id = parseInt(idStr);
  if (isNaN(id)) notFound();

  const [session, film, credits, similar, keywords, logoUrl, providers, externalIds, extras] =
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
    ]);

  if (!film) notFound();

  // Distinctions réelles (Wikidata). Dépend de external_ids, donc en second
  // temps ; un échec renvoie une liste vide et la fiche s'affiche quand même.
  const awards = externalIds.wikidataId ? await fetchAwards(externalIds.wikidataId) : [];

  // Films de la saga (hors film courant). `recommendations` en oublie une
  // partie — sur Star Wars, plusieurs épisodes n'apparaissaient pas.
  const sagaFilms = film.collectionId
    ? (await fetchFilmCollection(film.collectionId)).filter((f) => f.id !== film.id)
    : [];

  // Pas de doublon entre les deux blocs : ce qui est déjà dans la saga sort
  // des « films similaires ».
  const sagaIds = new Set(sagaFilms.map((f) => f.id));
  const similarFilms = similar.filter((s) => !sagaIds.has(s.id));

  const [userFilm, userLists, listsWithFilmRaw, friendFilms] = session
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
      ])
    : [null, [], [], []];

  const listsWithFilm = (listsWithFilmRaw as { listId: string }[]).map((r) => r.listId);

  const roi =
    film.budget > 0
      ? Math.round(((film.revenue - film.budget) / film.budget) * 100)
      : null;

  const showOriginalTitle = film.originalTitle && film.originalTitle !== film.title;
  const langLabel = LANG_NAMES[film.originalLanguage] ?? film.originalLanguage?.toUpperCase();

  return (
    <>
      {film.backdropUrl && (
        <div className={styles.backdrop} style={{ backgroundImage: `url("${film.backdropUrl}")` }} />
      )}
      <div className={styles.backdropOverlay} />

      <FilmTopbar />

      <div className={styles.hero}>
        {/* Colonne gauche : poster + actions */}
        <div className={styles.posterCol}>
          <div className={styles.poster}>
            {film.posterUrl && (
              <Image
                src={film.posterUrl}
                alt={film.title}
                fill
                priority
                sizes="280px"
                style={{ objectFit: "cover" }}
              />
            )}
          </div>
          <PosterActions
            tmdbId={id}
            initialWatchlist={userFilm?.watchlist ?? false}
            initialLiked={userFilm?.liked ?? false}
            userLists={userLists}
            listsWithFilm={listsWithFilm}
            isAuthenticated={!!session}
          />
        </div>

        {/* Colonne droite : métadonnées */}
        <div className={styles.metaCol}>
          {(film.genres.length > 0 || extras.certification) && (
            <div className={styles.genres}>
              {extras.certification && (
                <span className={styles.certification} title="Classification d'âge">
                  {extras.certification}
                </span>
              )}
              {film.genres.map((g) => (
                <span key={g} className={styles.genreTag}>{g}</span>
              ))}
            </div>
          )}

          <FilmTitleLogo
            logoUrl={logoUrl}
            title={film.title}
            titleClassName={styles.movieTitle}
            logoClassName={styles.movieTitleLogo}
          />

          {showOriginalTitle && (
            <div style={{ fontSize: 14, color: "var(--ink-mute)", marginTop: -20, marginBottom: 24, fontStyle: "italic" }}>
              {film.originalTitle}
            </div>
          )}

          <div className={styles.scores}>
            <div className={`${styles.scoreCard} ${styles.scoreAccent}`}>
              <div className={`${styles.scoreVal} ${styles.scoreGold}`}>★ <Rating value={film.voteAverage} /></div>
              <div className={styles.scoreLab}>Note TMDB</div>
            </div>
            <div className={styles.scoreCard}>
              <div className={styles.scoreVal}>{film.voteCount.toLocaleString("fr")}</div>
              <div className={styles.scoreLab}>Votes</div>
            </div>
            <div className={styles.scoreCard}>
              <div className={styles.scoreVal}>{film.popularity}</div>
              <div className={styles.scoreLab}>Popularité</div>
            </div>
            {film.runtime && (
              <div className={styles.scoreCard}>
                <div className={styles.scoreVal}>{formatRuntime(film.runtime)}</div>
                <div className={styles.scoreLab}>Durée</div>
              </div>
            )}
            {film.year && (
              <div className={styles.scoreCard}>
                <div className={styles.scoreVal}>{film.year}</div>
                <div className={styles.scoreLab}>Sortie</div>
              </div>
            )}
          </div>

          <RatingWidget
            tmdbId={id}
            initialRating={userFilm?.rating ?? 0}
            initialReview={userFilm?.review ?? ""}
            title={film.title}
            isAuthenticated={!!session}
            saveAction={saveRating}
            deleteAction={deleteRating}
          />

          {film.overview && (
            <div className={styles.section}>
              <div className={styles.sectionTitle}>Synopsis</div>
              <p className={styles.synopsis}>{film.overview}</p>
            </div>
          )}

          {/* Les avis des amis passent avant la bande-annonce : c'est le
              contenu propre au réseau de l'utilisateur, et le seul qu'il ne
              trouvera pas ailleurs. La bande-annonce, elle, reste consultable
              plus bas sans rien perdre. */}
          {friendFilms.length > 0 && (
            <FriendReviews
              reviews={friendFilms.map((f) => ({
                userId: f.user.id,
                name: f.user.name ?? "Utilisateur",
                avatarUrl: f.user.avatarUrl,
                rating: f.rating,
                review: f.review,
                date: f.updatedAt.toLocaleDateString("fr-FR"),
              }))}
            />
          )}

          {extras.video && (
            <TrailerSection
              video={extras.video}
              title={film.title}
              sectionClassName={styles.section}
              titleClassName={styles.sectionTitle}
            />
          )}

          <div className={styles.section}>
            <div className={styles.sectionTitle}>Fiche technique</div>
            <div className={styles.facts}>
              {credits.directors.length > 0 && (
                <div className={styles.fact}>
                  <div className={styles.factLab}>Réalisation</div>
                  <div className={styles.factVal}>
                    {credits.directors.map((d, i) => (
                      <span key={d.id}>
                        {i > 0 && ", "}
                        <Link href={`/actor/${d.id}`} className={styles.crewLink}>{d.name}</Link>
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {credits.writers.length > 0 && (
                <div className={styles.fact}>
                  <div className={styles.factLab}>Scénario</div>
                  <div className={styles.factVal}>
                    {credits.writers.map((w, i) => (
                      <span key={w.id}>
                        {i > 0 && ", "}
                        <Link href={`/actor/${w.id}`} className={styles.crewLink}>{w.name}</Link>
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {film.releaseDate && (
                <div className={styles.fact}>
                  <div className={styles.factLab}>Date de sortie</div>
                  <div className={styles.factVal}>
                    {new Date(film.releaseDate).toLocaleDateString("fr-FR")}
                  </div>
                </div>
              )}
              {film.runtime && (
                <div className={styles.fact}>
                  <div className={styles.factLab}>Durée</div>
                  <div className={styles.factVal}>{formatRuntime(film.runtime)}</div>
                </div>
              )}
              {langLabel && (
                <div className={styles.fact}>
                  <div className={styles.factLab}>Langue originale</div>
                  <div className={styles.factVal}>{langLabel}</div>
                </div>
              )}
              {film.productionCountries.length > 0 && (
                <div className={styles.fact}>
                  <div className={styles.factLab}>Pays d&apos;origine</div>
                  <div className={styles.factVal}>{film.productionCountries.slice(0, 3).join(", ")}</div>
                </div>
              )}
              {film.genres.length > 0 && (
                <div className={styles.fact}>
                  <div className={styles.factLab}>Genres</div>
                  <div className={styles.factVal}>{film.genres.join(", ")}</div>
                </div>
              )}
              {film.budget > 0 && (
                <div className={styles.fact}>
                  <div className={styles.factLab}>Budget</div>
                  <div className={styles.factVal}>{formatMoney(film.budget)}</div>
                </div>
              )}
              {film.revenue > 0 && (
                <div className={styles.fact}>
                  <div className={styles.factLab}>Recettes</div>
                  <div className={`${styles.factVal} ${film.revenue > film.budget ? styles.factPos : styles.factNeg}`}>
                    {formatMoney(film.revenue)}
                  </div>
                </div>
              )}
              {roi !== null && (
                <div className={styles.fact}>
                  <div className={styles.factLab}>ROI</div>
                  <div className={`${styles.factVal} ${roi > 0 ? styles.factPos : styles.factNeg}`}>
                    {roi > 0 ? "+" : ""}{roi}%
                  </div>
                </div>
              )}
              {extras.certification && (
                <div className={styles.fact}>
                  <div className={styles.factLab}>Classification</div>
                  <div className={styles.factVal}>{extras.certification}</div>
                </div>
              )}
            </div>

            <ExternalLinks ids={externalIds} />
          </div>

          {credits.cast.length > 0 && <CastGrid cast={credits.cast} />}

          {film.productionCompanies.length > 0 && (
            <div className={styles.section}>
              <div className={styles.sectionTitle}>Sociétés de production</div>
              <div className={styles.companies}>
                {film.productionCompanies.map((c) => (
                  <Link key={c.id} href={`/company/${c.id}`} className={styles.companyTag}>
                    {c.logoUrl && (
                      <Image
                        src={c.logoUrl}
                        alt=""
                        width={20}
                        height={20}
                        className={styles.companyLogo}
                      />
                    )}
                    {c.name}
                  </Link>
                ))}
              </div>
            </div>
          )}

          <AwardsSection
            awards={awards}
            sectionClassName={styles.section}
            titleClassName={styles.sectionTitle}
          />

          {keywords.length > 0 && (
            <div className={styles.section}>
              <div className={styles.sectionTitle}>Thèmes</div>
              <div className={styles.awardTags}>
                {/* TMDB en renvoie parfois plus de 50 : on s'arrête à 18, au-delà
                    c'est un nuage de tags illisible. */}
                {keywords.slice(0, 18).map((k) => (
                  <span key={k} className={styles.awardTag}>{k}</span>
                ))}
              </div>
            </div>
          )}

          {/* Placé juste avant les suggestions : le bloc est haut, il repoussait
              le reste de la fiche quand il était sous le synopsis. */}
          <WatchProvidersSection
            providers={providers}
            sectionClassName={styles.section}
            titleClassName={styles.sectionTitle}
          />

          {sagaFilms.length > 0 && (
            <SimilarFilms
              films={sagaFilms}
              title={film.collectionName || "La saga"}
              subtitle={`${sagaFilms.length + 1} films · dans l'ordre de sortie`}
            />
          )}

          {similarFilms.length > 0 && (
            <SimilarFilms films={similarFilms} title="Films similaires" />
          )}
        </div>
      </div>
    </>
  );
}
