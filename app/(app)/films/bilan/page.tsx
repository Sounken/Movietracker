import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { bilanYears, computeBilan, formatDuration } from "@/lib/bilan";
import { formatWatchDate } from "@/lib/watch-date";
import { Rating } from "@/lib/rating-scale";
import Topbar from "../../components/Topbar";
import { getGreeting } from "@/lib/greeting";
import BilanShare from "./BilanShare";
import styles from "./bilan.module.css";

export const metadata: Metadata = { title: "Bilan de l'année", robots: { index: false } };

const MONTHS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
const MONTHS_LONG = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];

export default async function BilanPage({
  searchParams,
}: {
  searchParams: Promise<{ annee?: string }>;
}) {
  const [session, { annee }] = await Promise.all([getSession(), searchParams]);
  if (!session) redirect("/login");

  const years = await bilanYears(session.userId);
  const year = years.includes(Number(annee)) ? Number(annee) : years[0];
  const bilan = await computeBilan(session.userId, year);
  const { films, series } = bilan;
  const empty = films.count === 0 && series.episodes === 0;
  const ongoing = year === new Date().getUTCFullYear();

  const maxMonth = Math.max(...bilan.months);
  const peak = maxMonth > 0 ? bilan.months.indexOf(maxMonth) : -1;
  const maxGenre = bilan.genres[0]?.count ?? 0;

  return (
    <div>
      <Topbar greeting={getGreeting()} userName={session.name} />

      <header className={styles.hero}>
        <div>
          <div className={styles.sectionSub}>Bilan</div>
          <h2 className={styles.heroTitle}>
            Votre année <em>{year}</em>
          </h2>
          {ongoing && !empty && (
            <p className={styles.heroNote}>L&apos;année n&apos;est pas finie : bilan arrêté à aujourd&apos;hui.</p>
          )}
        </div>
        <div className={styles.heroSide}>
          {years.length > 1 && (
            <nav className={styles.years} aria-label="Année">
              {years.map((y) => (
                <Link
                  key={y}
                  href={y === years[0] ? "/films/bilan" : `/films/bilan?annee=${y}`}
                  className={`${styles.year} ${y === year ? styles.yearOn : ""}`}
                  aria-current={y === year ? "page" : undefined}
                >
                  {y}
                </Link>
              ))}
            </nav>
          )}
          {!empty && <BilanShare year={year} />}
        </div>
      </header>

      {empty ? (
        <div className={styles.empty}>
          Rien de vu en {year} pour l&apos;instant. Les films de votre journal et les épisodes cochés
          apparaîtront ici.
        </div>
      ) : (
        <>
          <section className={styles.stats}>
            <div className={styles.stat}>
              <div className={styles.statVal}>{films.count}</div>
              <div className={styles.statLabel}>film{films.count > 1 ? "s" : ""} vu{films.count > 1 ? "s" : ""}</div>
            </div>
            <div className={styles.stat}>
              <div className={styles.statVal}>{formatDuration(films.minutes + series.minutes)}</div>
              <div className={styles.statLabel}>devant l&apos;écran</div>
            </div>
            <div className={styles.stat}>
              <div className={styles.statVal}>{series.episodes}</div>
              <div className={styles.statLabel}>épisode{series.episodes > 1 ? "s" : ""}</div>
            </div>
            <div className={styles.stat}>
              <div className={styles.statVal}>{films.rewatches}</div>
              <div className={styles.statLabel}>revisionnage{films.rewatches > 1 ? "s" : ""}</div>
            </div>
            <div className={styles.stat}>
              <div className={styles.statVal}>
                {films.avgRating != null ? (
                  <>
                    <span className={styles.statStar}>★</span> <Rating value={films.avgRating} />
                  </>
                ) : (
                  "—"
                )}
              </div>
              <div className={styles.statLabel}>note moyenne</div>
            </div>
          </section>

          {bilan.topFilms.length > 0 && (
            <section className={styles.section}>
              <h3 className={styles.sectionTitle}>Vos préférés de l&apos;année</h3>
              <ol className={styles.top}>
                {bilan.topFilms.map((f, i) => (
                  <li key={f.tmdbId}>
                    <Link href={`/film/${f.tmdbId}`} className={styles.topItem}>
                      <span className={styles.topRank}>{i + 1}</span>
                      {f.posterUrl ? (
                        <Image src={f.posterUrl} alt="" width={160} height={240} className={styles.topPoster} />
                      ) : (
                        <span className={styles.topPoster} />
                      )}
                      <span className={styles.topTitle}>{f.title}</span>
                      <span className={styles.topRating}>★ <Rating value={f.rating} /></span>
                    </Link>
                  </li>
                ))}
              </ol>
            </section>
          )}

          {films.count > 0 && (
            <section className={styles.section}>
              <h3 className={styles.sectionTitle}>Films vus par mois</h3>
              {/* Une seule série : pas de légende, le titre la nomme. Le mois
                  record est annoté ; les autres valeurs passent au survol. */}
              <div className={styles.chart} role="img" aria-label={`Films vus par mois en ${year}`}>
                {bilan.months.map((count, m) => (
                  <div
                    key={m}
                    className={styles.barCol}
                    tabIndex={0}
                    data-tip={`${MONTHS_LONG[m]} : ${count} film${count > 1 ? "s" : ""}`}
                  >
                    <div className={styles.barTrack}>
                      {m === peak && <span className={styles.barValue}>{count}</span>}
                      <div
                        className={styles.bar}
                        style={{ height: maxMonth > 0 ? `${(count / maxMonth) * 100}%` : 0 }}
                      />
                    </div>
                    <span className={styles.barLabel}>{MONTHS[m]}</span>
                  </div>
                ))}
              </div>
              <table className={styles.srOnly}>
                <caption>Films vus par mois en {year}</caption>
                <tbody>
                  {bilan.months.map((count, m) => (
                    <tr key={m}>
                      <th scope="row">{MONTHS_LONG[m]}</th>
                      <td>{count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}

          <div className={styles.columns}>
            {bilan.genres.length > 0 && (
              <section className={styles.card}>
                <h3 className={styles.sectionTitle}>Genres</h3>
                <ul className={styles.genres}>
                  {bilan.genres.map((g) => (
                    <li key={g.name} className={styles.genre}>
                      <span className={styles.genreName}>{g.name}</span>
                      <span className={styles.genreTrack}>
                        <span className={styles.genreBar} style={{ width: `${(g.count / maxGenre) * 100}%` }} />
                      </span>
                      <span className={styles.genreCount}>{g.count}</span>
                    </li>
                  ))}
                </ul>
                {bilan.decade && (
                  <p className={styles.cardNote}>
                    Décennie la plus présente : <strong>les années {bilan.decade}</strong>
                  </p>
                )}
              </section>
            )}

            {(bilan.firstFilm || series.top.length > 0) && (
              <section className={styles.card}>
                <h3 className={styles.sectionTitle}>Repères</h3>
                <ul className={styles.marks}>
                  {bilan.firstFilm && (
                    <li>
                      <span className={styles.markLabel}>Premier film</span>
                      <Link href={`/film/${bilan.firstFilm.tmdbId}`}>{bilan.firstFilm.title}</Link>
                      <span className={styles.markSub}>{formatWatchDate(bilan.firstFilm.date)}</span>
                    </li>
                  )}
                  {bilan.lastFilm && (
                    <li>
                      <span className={styles.markLabel}>{ongoing ? "Dernier en date" : "Dernier film"}</span>
                      <Link href={`/film/${bilan.lastFilm.tmdbId}`}>{bilan.lastFilm.title}</Link>
                      <span className={styles.markSub}>{formatWatchDate(bilan.lastFilm.date)}</span>
                    </li>
                  )}
                  {peak >= 0 && (
                    <li>
                      <span className={styles.markLabel}>Mois le plus chargé</span>
                      <span>{MONTHS_LONG[peak]}</span>
                      <span className={styles.markSub}>{maxMonth} film{maxMonth > 1 ? "s" : ""}</span>
                    </li>
                  )}
                  {series.top.map((s, i) => (
                    <li key={s.tmdbId}>
                      <span className={styles.markLabel}>{i === 0 ? "Série la plus suivie" : ""}</span>
                      <Link href={`/series/${s.tmdbId}`}>{s.name}</Link>
                      <span className={styles.markSub}>{s.episodes} épisode{s.episodes > 1 ? "s" : ""}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        </>
      )}
    </div>
  );
}
