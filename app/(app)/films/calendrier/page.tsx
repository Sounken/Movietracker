import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { getCalendar, type CalendarEntry } from "@/lib/calendar";
import { shiftDay } from "@/lib/releases";
import Topbar from "../../components/Topbar";
import ReminderToggle from "../../components/ReminderToggle";
import { getGreeting } from "@/lib/greeting";
import styles from "./calendrier.module.css";

export const metadata: Metadata = { title: "Calendrier", robots: { index: false } };

const KIND_LABEL: Record<CalendarEntry["kind"], string> = {
  cinema: "Au cinéma",
  digital: "En numérique",
  episode: "Épisode",
};

function dayLabel(day: string, today: string): string {
  if (day === today) return "Aujourd'hui";
  if (day === shiftDay(today, 1)) return "Demain";
  if (day === shiftDay(today, -1)) return "Hier";
  const date = new Date(`${day}T00:00:00Z`);
  const sameYear = day.slice(0, 4) === today.slice(0, 4);
  return new Intl.DateTimeFormat("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    ...(sameYear ? {} : { year: "numeric" }),
    timeZone: "UTC",
  }).format(date);
}

function groupByDay(entries: CalendarEntry[]) {
  const groups: { day: string; items: CalendarEntry[] }[] = [];
  for (const e of entries) {
    if (groups.at(-1)?.day !== e.date) groups.push({ day: e.date, items: [] });
    groups.at(-1)!.items.push(e);
  }
  return groups;
}

function Entry({ entry }: { entry: CalendarEntry }) {
  const href = entry.media === "tv" ? `/series/${entry.tmdbId}` : `/film/${entry.tmdbId}`;
  return (
    <li className={styles.row}>
      <Link href={href} className={styles.rowLink}>
        {entry.posterUrl ? (
          <Image src={entry.posterUrl} alt="" width={40} height={60} className={styles.poster} />
        ) : (
          <span className={styles.poster} />
        )}
        <span className={styles.info}>
          <span className={styles.title}>{entry.title}</span>
          <span className={styles.meta}>
            <span className={`${styles.badge} ${styles[entry.kind]}`}>{KIND_LABEL[entry.kind]}</span>
            {entry.detail && <span className={styles.detail}>{entry.detail}</span>}
            {entry.foreignDate && <span className={styles.detail}>date hors France</span>}
          </span>
        </span>
      </Link>
      {entry.media === "movie" && <ReminderToggle tmdbId={entry.tmdbId} initial={entry.reminded} compact />}
    </li>
  );
}

export default async function CalendarPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const { today, upcoming, recent } = await getCalendar(session.userId);

  return (
    <div>
      <Topbar greeting={getGreeting()} userName={session.name} />

      <div className={styles.head}>
        <div className={styles.sectionSub}>Bibliothèque</div>
        <h2 className={styles.sectionTitle}>Calendrier</h2>
        <p className={styles.lead}>
          Les sorties françaises des films que vous attendez et les épisodes de vos séries. Avec la
          cloche, vous êtes prévenu le jour J.
        </p>
      </div>

      {upcoming.length === 0 && recent.length === 0 ? (
        <div className={styles.empty}>
          Rien à l&apos;horizon. Ajoutez un film pas encore sorti à « À voir » (ou activez « Me
          prévenir » sur sa fiche), et suivez une série en cours : leurs dates apparaîtront ici.
        </div>
      ) : (
        <>
          <section className={styles.section}>
            <h3 className={styles.groupTitle}>À venir</h3>
            {upcoming.length === 0 ? (
              <p className={styles.none}>Aucune date annoncée pour l&apos;instant.</p>
            ) : (
              groupByDay(upcoming).map((g) => (
                <div key={g.day} className={styles.day}>
                  <div className={`${styles.dayLabel} ${g.day === today ? styles.dayToday : ""}`}>
                    {dayLabel(g.day, today)}
                  </div>
                  <ul className={styles.list}>
                    {g.items.map((e) => (
                      <Entry key={`${e.media}-${e.tmdbId}-${e.detail}`} entry={e} />
                    ))}
                  </ul>
                </div>
              ))
            )}
          </section>

          {recent.length > 0 && (
            <section className={styles.section}>
              <h3 className={styles.groupTitle}>Sorti ces 7 derniers jours</h3>
              {groupByDay(recent).map((g) => (
                <div key={g.day} className={styles.day}>
                  <div className={styles.dayLabel}>{dayLabel(g.day, today)}</div>
                  <ul className={styles.list}>
                    {g.items.map((e) => (
                      <Entry key={`${e.media}-${e.tmdbId}-${e.detail}`} entry={e} />
                    ))}
                  </ul>
                </div>
              ))}
            </section>
          )}
        </>
      )}
    </div>
  );
}
