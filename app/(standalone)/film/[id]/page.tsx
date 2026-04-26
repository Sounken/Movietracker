import Link from "next/link";
import { notFound } from "next/navigation";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import { fetchFilmDetail, fetchFilmCredits, fetchSimilarFilms, fetchFilmKeywords, formatMoney, formatRuntime } from "@/lib/tmdb";
import FilmTopbar from "./components/FilmTopbar";
import PosterActions from "./components/PosterActions";
import RatingWidget from "./components/RatingWidget";
import CastGrid from "./components/CastGrid";
import styles from "./film.module.css";

const LANG_NAMES: Record<string, string> = {
  en: "Anglais", fr: "Français", es: "Espagnol", de: "Allemand", it: "Italien",
  ja: "Japonais", ko: "Coréen", zh: "Chinois", pt: "Portugais", ru: "Russe",
  ar: "Arabe", hi: "Hindi", nl: "Néerlandais", sv: "Suédois", da: "Danois",
};

export default async function FilmPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: idStr } = await params;
  const id = parseInt(idStr);
  if (isNaN(id)) notFound();

  const [session, film, credits, similar, keywords] = await Promise.all([
    getSession(),
    fetchFilmDetail(id),
    fetchFilmCredits(id),
    fetchSimilarFilms(id),
    fetchFilmKeywords(id),
  ]);

  if (!film) notFound();

  const [userFilm, userLists, listsWithFilmRaw] = session
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
      ])
    : [null, [], []];

  const listsWithFilm = (listsWithFilmRaw as { listId: string }[]).map((r) => r.listId);

  const roi =
    film.budget > 0
      ? Math.round(((film.revenue - film.budget) / film.budget) * 100)
      : null;

  const words = film.title.split(" ");
  const showOriginalTitle = film.originalTitle && film.originalTitle !== film.title;
  const langLabel = LANG_NAMES[film.originalLanguage] ?? film.originalLanguage?.toUpperCase();

  const AWARD_KEYWORDS = ["oscar", "academy award", "cannes", "golden globe", "palme d'or", "césar", "bafta", "venice", "berlin", "sundance", "prix du jury", "grand prix"];
  const awardKeywords = keywords.filter((k) =>
    AWARD_KEYWORDS.some((a) => k.toLowerCase().includes(a))
  );

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
          <div
            className={styles.poster}
            style={film.posterUrl ? { backgroundImage: `url("${film.posterUrl}")` } : undefined}
          />
          <PosterActions
            tmdbId={id}
            initialRating={userFilm?.rating ?? 0}
            initialWatchlist={userFilm?.watchlist ?? false}
            initialLiked={userFilm?.liked ?? false}
            userLists={userLists}
            listsWithFilm={listsWithFilm}
          />
        </div>

        {/* Colonne droite : métadonnées */}
        <div className={styles.metaCol}>
          {film.genres.length > 0 && (
            <div className={styles.genres}>
              {film.genres.map((g) => (
                <span key={g} className={styles.genreTag}>{g}</span>
              ))}
            </div>
          )}

          <h1 className={styles.movieTitle}>
            <em>{words[0]}</em>
            {words.length > 1 ? " " + words.slice(1).join(" ") : ""}
          </h1>

          {showOriginalTitle && (
            <div style={{ fontSize: 14, color: "var(--ink-mute)", marginTop: -20, marginBottom: 24, fontStyle: "italic" }}>
              {film.originalTitle}
            </div>
          )}

          <div className={styles.scores}>
            <div className={`${styles.scoreCard} ${styles.scoreAccent}`}>
              <div className={`${styles.scoreVal} ${styles.scoreGold}`}>★ {film.voteAverage}</div>
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
            filmTitle={film.title}
          />

          {film.overview && (
            <div className={styles.section}>
              <div className={styles.sectionTitle}>Synopsis</div>
              <p className={styles.synopsis}>{film.overview}</p>
            </div>
          )}

          <div className={styles.section}>
            <div className={styles.sectionTitle}>Fiche technique</div>
            <div className={styles.facts}>
              {credits.directors.length > 0 && (
                <div className={styles.fact}>
                  <div className={styles.factLab}>Réalisation</div>
                  <div className={styles.factVal}>{credits.directors.join(", ")}</div>
                </div>
              )}
              {credits.writers.length > 0 && (
                <div className={styles.fact}>
                  <div className={styles.factLab}>Scénario</div>
                  <div className={styles.factVal}>{credits.writers.join(", ")}</div>
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
            </div>
          </div>

          {credits.cast.length > 0 && <CastGrid cast={credits.cast} />}

          {film.productionCompanies.length > 0 && (
            <div className={styles.section}>
              <div className={styles.sectionTitle}>Sociétés de production</div>
              <div className={styles.companies}>
                {film.productionCompanies.map((c) => (
                  <div key={c} className={styles.companyTag}>{c}</div>
                ))}
              </div>
            </div>
          )}

          {awardKeywords.length > 0 && (
            <div className={styles.section}>
              <div className={styles.sectionTitle}>Distinctions</div>
              <div className={styles.awardTags}>
                {awardKeywords.map((k) => (
                  <span key={k} className={styles.awardTag}>{k}</span>
                ))}
              </div>
            </div>
          )}

          {similar.length > 0 && (
            <div className={styles.section}>
              <div className={styles.sectionTitle}>Films similaires</div>
              <div className={styles.similarGrid}>
                {similar.map((s) => (
                  <Link key={s.id} href={`/film/${s.id}`} className={styles.similarCard}>
                    {s.posterUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={s.posterUrl} alt={s.title} className={styles.similarPoster} />
                    ) : (
                      <div className={styles.similarPosterEmpty} />
                    )}
                    <div className={styles.similarTitle}>{s.title}</div>
                    {s.year && <div className={styles.similarYear}>{s.year}</div>}
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
