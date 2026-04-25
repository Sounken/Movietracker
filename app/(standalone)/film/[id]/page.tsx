import { notFound } from "next/navigation";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import { fetchFilmDetail, fetchFilmCredits, formatMoney, formatRuntime } from "@/lib/tmdb";
import FilmTopbar from "./components/FilmTopbar";
import PosterActions from "./components/PosterActions";
import RatingWidget from "./components/RatingWidget";
import styles from "./film.module.css";

function castColor(name: string) {
  const hues = [18, 200, 280, 140, 30, 340, 60, 220];
  return `hsl(${hues[name.charCodeAt(0) % hues.length]}, 35%, 28%)`;
}

export default async function FilmPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: idStr } = await params;
  const id = parseInt(idStr);
  if (isNaN(id)) notFound();

  const [session, film, credits] = await Promise.all([
    getSession(),
    fetchFilmDetail(id),
    fetchFilmCredits(id),
  ]);

  if (!film) notFound();

  const userFilm = session
    ? await prisma.userFilm.findUnique({
        where: { userId_tmdbId: { userId: session.userId, tmdbId: id } },
      })
    : null;

  const roi =
    film.budget > 0
      ? Math.round(((film.revenue - film.budget) / film.budget) * 100)
      : null;

  const words = film.title.split(" ");

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

          <div className={styles.scores}>
            <div className={`${styles.scoreCard} ${styles.scoreAccent}`}>
              <div className={`${styles.scoreVal} ${styles.scoreGold}`}>★ {film.voteAverage}</div>
              <div className={styles.scoreLab}>Note moyenne</div>
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

          {credits.length > 0 && (
            <div className={styles.section}>
              <div className={styles.sectionTitle}>Casting</div>
              <div className={styles.castGrid}>
                {credits.map((c) => (
                  <div key={c.id} className={styles.castCard}>
                    <div className={styles.castAvatar} style={{ background: castColor(c.name) }}>
                      {c.name.split(" ").map((w) => w[0]).join("").slice(0, 2)}
                    </div>
                    <div className={styles.castName}>{c.name}</div>
                    <div className={styles.castRole}>{c.character}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

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
        </div>
      </div>
    </>
  );
}
