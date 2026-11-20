import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { getCalendar, type CalendarEntry } from "@/lib/calendar";
import { fetchFilmDetail, fetchSeriesDetail } from "@/lib/tmdb";
import ReminderToggle from "../../components/ReminderToggle";
import styles from "./calendrier.module.css";

export const metadata: Metadata = { title: "Calendrier", robots: { index: false } };

const KIND_LABEL: Record<CalendarEntry["kind"], string> = {
  cinema: "Au cinéma",
  digital: "En numérique",
  episode: "Épisode",
};

const WEEKDAYS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
const fmt = (opts: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("fr-FR", { ...opts, timeZone: "UTC" });
const DAY_LONG = fmt({ weekday: "long", day: "numeric", month: "long" });
const DAY_SHORT = fmt({ day: "numeric", month: "short" });
const MONTH_YEAR = fmt({ month: "long", year: "numeric" });

const asDate = (day: string) => new Date(`${day}T00:00:00Z`);
const hrefOf = (e: CalendarEntry) => (e.media === "tv" ? `/series/${e.tmdbId}` : `/film/${e.tmdbId}`);

/** Jours entre aujourd'hui et la date, en libellé lisible. */
function countdown(day: string, today: string): string {
  const days = Math.round((asDate(day).getTime() - asDate(today).getTime()) / 86_400_000);
  if (days <= 0) return "Aujourd'hui";
  if (days === 1) return "Demain";
  return `Dans ${days} jours`;
}

/** Cases d'un mois, semaines du lundi au dimanche ; `null` hors du mois. */
function monthCells(year: number, month: number): (string | null)[] {
  const first = new Date(Date.UTC(year, month, 1));
  const lead = (first.getUTCDay() + 6) % 7;
  const days = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const cells: (string | null)[] = Array.from({ length: lead }, () => null);
  for (let d = 1; d <= days; d++) cells.push(new Date(Date.UTC(year, month, d)).toISOString().slice(0, 10));
  while (cells.length % 7) cells.push(null);
  return cells;
}

function KindBadge({ kind }: { kind: CalendarEntry["kind"] }) {
  return <span className={`${styles.badge} ${styles[kind]}`}>{KIND_LABEL[kind]}</span>;
}

/** Affiche datée des rails « Plus tard » et « Sorti récemment ». */
function DatedPoster({ entry }: { entry: CalendarEntry }) {
  const d = asDate(entry.date);
  return (
    <Link href={hrefOf(entry)} className={styles.railCard}>
      <span className={styles.railPoster}>
        {entry.posterUrl && <Image src={entry.posterUrl} alt="" fill sizes="150px" style={{ objectFit: "cover" }} />}
        <span className={styles.dateChip}>
          <b>{d.getUTCDate()}</b>
          {fmt({ month: "short" }).format(d).replace(".", "")}
        </span>
      </span>
      <span className={styles.railTitle}>{entry.title}</span>
      <span className={styles.railMeta}>
        <KindBadge kind={entry.kind} />
        {entry.detail && <span className={styles.detail}>{entry.detail.split(" · ")[0]}</span>}
      </span>
    </Link>
  );
}

export default async function CalendarPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const { today, upcoming, recent } = await getCalendar(session.userId);
  const next = upcoming[0] ?? null;

  // Fond et résumé du prochain rendez-vous (fiches déjà en cache TMDB)
  const nextDetail = next
    ? next.media === "movie"
      ? await fetchFilmDetail(next.tmdbId)
      : await fetchSeriesDetail(next.tmdbId).catch(() => null)
    : null;

  // Agenda : le mois en cours et le suivant
  const [y, m] = today.split("-").map(Number);
  const months = [0, 1].map((offset) => {
    const date = new Date(Date.UTC(y, m - 1 + offset, 1));
    return { label: MONTH_YEAR.format(date), cells: monthCells(date.getUTCFullYear(), date.getUTCMonth()) };
  });
  const agendaEnd = new Date(Date.UTC(y, m + 1, 0)).toISOString().slice(0, 10);
  const byDay = new Map<string, CalendarEntry[]>();
  for (const e of upcoming) byDay.set(e.date, [...(byDay.get(e.date) ?? []), e]);
  const later = upcoming.filter((e) => e.date > agendaEnd);
  const queue = upcoming.slice(1, 5);

  const empty = upcoming.length === 0 && recent.length === 0;

  return (
    <div className={styles.page} {...(next ? { "data-hero": "" } : {})}>
      {next ? (
        <section className={styles.hero}>
          {nextDetail?.backdropUrl && (
            <div className={styles.kb}>
              <Image src={nextDetail.backdropUrl} alt="" fill priority sizes="100vw" style={{ objectFit: "cover" }} />
            </div>
          )}
          <div className={styles.veil} />

          <div className={styles.heroText}>
            <div className={styles.kicker}>
              <span className={styles.dot} />
              Prochain rendez-vous • {KIND_LABEL[next.kind]}
            </div>
            <div className={styles.countdown}>{countdown(next.date, today)}</div>
            <h1 className={styles.heroTitle} style={{ fontSize: next.title.length > 22 ? 44 : 64 }}>{next.title}</h1>
            <div className={styles.heroMeta}>
              <span className={styles.heroDate}>{DAY_LONG.format(asDate(next.date))}</span>
              {next.detail && <span>{next.detail}</span>}
              {next.foreignDate && <span>date hors France</span>}
            </div>
            {nextDetail?.overview && <p className={styles.synopsis}>{nextDetail.overview}</p>}
            <div className={styles.actions}>
              <Link href={hrefOf(next)} className={`${styles.btn} ${styles.btnP}`}>Voir la fiche</Link>
              {next.media === "movie" && (
                <span className={styles.reminder}>
                  <ReminderToggle tmdbId={next.tmdbId} initial={next.reminded} label="Me prévenir le jour J" />
                </span>
              )}
            </div>
          </div>

          {queue.length > 0 && (
            <div className={styles.queue}>
              <div className={styles.queueHead}>Ensuite</div>
              {queue.map((e) => (
                <Link key={`${e.media}-${e.tmdbId}-${e.detail}`} href={hrefOf(e)} className={styles.queueItem}>
                  <span className={styles.queuePoster}>
                    {e.posterUrl && <Image src={e.posterUrl} alt="" fill sizes="36px" style={{ objectFit: "cover" }} />}
                  </span>
                  <span className={styles.queueText}>
                    <span className={styles.queueTitle}>{e.title}</span>
                    <span className={styles.queueMeta}>{DAY_SHORT.format(asDate(e.date))} • {KIND_LABEL[e.kind]}</span>
                  </span>
                </Link>
              ))}
            </div>
          )}
        </section>
      ) : null}

      <div className={next ? styles.below : undefined}>
        <div className={styles.head}>
          <div className={styles.sectionSub}>Bibliothèque</div>
          <h2 className={styles.sectionTitle}>Calendrier</h2>
          <p className={styles.lead}>
            Les sorties françaises des films que vous attendez et les épisodes de vos séries. Avec la cloche, vous
            êtes prévenu le jour J.
          </p>
        </div>

        {empty ? (
          <div className={styles.empty}>
            Rien à l&apos;horizon. Ajoutez un film pas encore sorti à « À voir » (ou activez « Me prévenir » sur sa
            fiche), et suivez une série en cours : leurs dates apparaîtront ici.
          </div>
        ) : (
          <>
            {/* Agenda : mois en cours et suivant */}
            <div className={styles.agenda}>
              {months.map((month) => (
                <section key={month.label} className={styles.monthCard}>
                  <h3 className={styles.monthTitle}>{month.label}</h3>
                  <div className={styles.weekdays}>
                    {WEEKDAYS.map((d) => <span key={d}>{d}</span>)}
                  </div>
                  <div className={styles.cells}>
                    {month.cells.map((day, i) => {
                      if (!day) return <span key={`x${i}`} className={styles.cellOff} />;
                      const items = byDay.get(day) ?? [];
                      return (
                        <div
                          key={day}
                          className={`${styles.cell} ${day < today ? styles.cellPast : ""} ${day === today ? styles.cellToday : ""} ${items.length ? styles.cellBusy : ""}`}
                        >
                          <span className={styles.cellNum}>{Number(day.slice(8))}</span>
                          {items.length > 0 && (
                            <span className={styles.cellPosters}>
                              {items.slice(0, 2).map((e) => (
                                <Link
                                  key={`${e.media}-${e.tmdbId}-${e.detail}`}
                                  href={hrefOf(e)}
                                  className={styles.cellPoster}
                                  title={`${e.title} • ${KIND_LABEL[e.kind]}${e.detail ? ` • ${e.detail}` : ""}`}
                                >
                                  {e.posterUrl && <Image src={e.posterUrl} alt={e.title} fill sizes="40px" style={{ objectFit: "cover" }} />}
                                </Link>
                              ))}
                              {items.length > 2 && <span className={styles.cellMore}>+{items.length - 2}</span>}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </section>
              ))}
            </div>

            {later.length > 0 && (
              <section className={styles.railBlock}>
                <h3 className={styles.blockTitle}>Plus tard</h3>
                <div className={styles.rail}>
                  {later.map((e) => <DatedPoster key={`${e.media}-${e.tmdbId}-${e.detail}`} entry={e} />)}
                </div>
              </section>
            )}

            {recent.length > 0 && (
              <section className={styles.railBlock}>
                <h3 className={styles.blockTitle}>Sorti ces 7 derniers jours</h3>
                <div className={styles.rail}>
                  {recent.map((e) => <DatedPoster key={`${e.media}-${e.tmdbId}-${e.detail}`} entry={e} />)}
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </div>
  );
}
