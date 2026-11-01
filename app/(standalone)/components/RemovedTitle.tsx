import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";
import { searchTmdbTitles } from "@/lib/tmdb";
import { removeDeletedFilm } from "@/app/actions/film";
import { removeDeletedSeries } from "@/app/actions/series";
import FilmTopbar from "../film/[id]/components/FilmTopbar";
import RemoveDeletedButton from "./RemoveDeletedButton";
import styles from "./RemovedTitle.module.css";

/**
 * Fiche d'un titre que TMDB a supprimé ou fusionné, mais que l'application
 * connaît encore (cache des cartes, bibliothèques).
 *
 * Constaté avec « Cyberpunk: Edgerunners 2 » : publiée d'abord comme série à
 * part, puis rattachée comme saison 2 de la série d'origine. L'entrée restait
 * dans une watchlist et menait à une 404 sèche, sans moyen de la retirer ni
 * de comprendre pourquoi. Un identifiant que l'application n'a jamais vu
 * reste, lui, une vraie 404.
 */
export default async function RemovedTitle({ kind, tmdbId }: { kind: "movie" | "tv"; tmdbId: number }) {
  const isFilm = kind === "movie";
  const cached = isFilm
    ? await prisma.film.findUnique({ where: { tmdbId }, select: { title: true, posterUrl: true, year: true } })
    : await prisma.series.findUnique({ where: { tmdbId }, select: { name: true, posterUrl: true, year: true } });
  if (!cached) notFound();

  const title = "title" in cached ? cached.title : cached.name;
  const session = await getSession();
  const [inLibrary, suggestions] = await Promise.all([
    session ? libraryHas(kind, session.userId, tmdbId) : Promise.resolve(false),
    searchTmdbTitles(kind, title).then((hits) => hits.filter((h) => h.id !== tmdbId)),
  ]);
  const noun = isFilm ? "ce film" : "cette série";
  const base = isFilm ? "/film" : "/series";

  return (
    <>
      <FilmTopbar fallbackHref={isFilm ? "/films" : "/series"} />
      <div className={styles.page}>
        <div className={styles.card}>
          {cached.posterUrl && (
            <Image src={cached.posterUrl} alt="" width={110} height={165} className={styles.poster} />
          )}
          <div className={styles.body}>
            <div className={styles.kicker}>Fiche retirée par TMDB</div>
            <h1 className={styles.title}>
              {title} {cached.year && <span>({cached.year})</span>}
            </h1>
            <p className={styles.text}>
              TMDB, la base de données d&apos;où viennent nos fiches, a supprimé ou fusionné {noun}.
              Cela arrive par exemple quand une saison, d&apos;abord publiée à part, est
              rattachée à sa série d&apos;origine.
            </p>
            {inLibrary && (
              <RemoveDeletedButton
                tmdbId={tmdbId}
                remove={isFilm ? removeDeletedFilm : removeDeletedSeries}
              />
            )}
          </div>
        </div>

        {suggestions.length > 0 && (
          <section className={styles.suggestions}>
            <h2 className={styles.suggestTitle}>Peut-être cherchiez-vous</h2>
            <div className={styles.grid}>
              {suggestions.map((s) => (
                <Link key={s.id} href={`${base}/${s.id}`} className={styles.hit}>
                  <div className={styles.hitPoster}>
                    {s.posterUrl && <Image src={s.posterUrl} alt="" fill sizes="140px" style={{ objectFit: "cover" }} />}
                  </div>
                  <div className={styles.hitTitle}>{s.title}</div>
                  {s.year && <div className={styles.hitYear}>{s.year}</div>}
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>
    </>
  );
}

async function libraryHas(kind: "movie" | "tv", userId: string, tmdbId: number): Promise<boolean> {
  if (kind === "movie") {
    const [entry, fav, listed] = await Promise.all([
      prisma.userFilm.count({ where: { userId, tmdbId } }),
      prisma.userFavoriteFilm.count({ where: { userId, tmdbId } }),
      prisma.userListFilm.count({ where: { tmdbId, list: { userId } } }),
    ]);
    return entry + fav + listed > 0;
  }
  const [entry, fav, episodes] = await Promise.all([
    prisma.userSeries.count({ where: { userId, tmdbId } }),
    prisma.userFavoriteSeries.count({ where: { userId, tmdbId } }),
    prisma.userEpisode.count({ where: { userId, seriesId: tmdbId } }),
  ]);
  return entry + fav + episodes > 0;
}
