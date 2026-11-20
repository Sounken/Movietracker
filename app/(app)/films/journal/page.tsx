import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import { getFilmCards } from "@/lib/films";
import { Rating } from "@/lib/rating-scale";
import { formatHours } from "../home-data";
import styles from "./journal.module.css";

export const metadata: Metadata = { title: "Journal", robots: { index: false } };

const PAGE_SIZE = 100;

const MONTH_NAME = new Intl.DateTimeFormat("fr-FR", { month: "long", timeZone: "UTC" });
const MONTH_SHORT = new Intl.DateTimeFormat("fr-FR", { month: "short", timeZone: "UTC" });
const WEEKDAY = new Intl.DateTimeFormat("fr-FR", { weekday: "short", timeZone: "UTC" });
const DAY_FULL = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });

const dayKey = (d: Date) => d.toISOString().slice(0, 10);

/**
 * Frise de l'année, une case par jour, semaines en colonnes (du lundi au
 * dimanche). Les jours hors de l'année ou à venir restent vides.
 */
function yearGrid(year: number, counts: Map<string, number>, today: string) {
  const first = new Date(Date.UTC(year, 0, 1));
  // Recule au lundi de la première semaine
  const start = new Date(first);
  start.setUTCDate(first.getUTCDate() - ((first.getUTCDay() + 6) % 7));
  const weeks: { key: string; count: number; inYear: boolean; future: boolean }[][] = [];
  const months: { label: string; col: number }[] = [];
  const cursor = new Date(start);
  for (let w = 0; cursor.getUTCFullYear() <= year; w++) {
    const week = [];
    for (let d = 0; d < 7; d++) {
      const key = dayKey(cursor);
      const inYear = cursor.getUTCFullYear() === year;
      if (inYear && cursor.getUTCDate() === 1) months.push({ label: MONTH_SHORT.format(cursor), col: w });
      week.push({ key, count: counts.get(key) ?? 0, inYear, future: key > today });
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
    weeks.push(week);
  }
  return { weeks, months };
}

export default async function JournalPage({
  searchParams,
}: {
  searchParams: Promise<{ apres?: string }>;
}) {
  const [session, { apres }] = await Promise.all([getSession(), searchParams]);
  if (!session) redirect("/login");
  const userId = session.userId;
  const now = new Date();
  const year = now.getUTCFullYear();
  const yearStart = new Date(Date.UTC(year, 0, 1));
  const monthStart = new Date(Date.UTC(year, now.getUTCMonth(), 1));
  const today = dayKey(now);

  // Pagination par curseur : « Plus anciens » repart de la dernière ligne
  // affichée. Un curseur inconnu ou d'un autre compte retombe sur le début.
  const cursor = apres
    ? await prisma.filmWatch.findFirst({ where: { id: apres, userId }, select: { id: true } })
    : null;

  const [rows, yearWatches, total] = await Promise.all([
    prisma.filmWatch.findMany({
      where: { userId },
      orderBy: [{ watchedAt: "desc" }, { createdAt: "desc" }, { id: "desc" }],
      take: PAGE_SIZE + 1,
      ...(cursor ? { cursor: { id: cursor.id }, skip: 1 } : {}),
      select: { id: true, tmdbId: true, watchedAt: true, note: true, createdAt: true },
    }),
    // Toute l'année en cours, pour les chiffres et la frise
    prisma.filmWatch.findMany({
      where: { userId, watchedAt: { gte: yearStart } },
      select: { tmdbId: true, watchedAt: true },
    }),
    prisma.filmWatch.count({ where: { userId } }),
  ]);
  const hasMore = rows.length > PAGE_SIZE;
  const watches = rows.slice(0, PAGE_SIZE);
  const tmdbIds = [...new Set([...watches.map((w) => w.tmdbId), ...yearWatches.map((w) => w.tmdbId)])];

  // Un visionnage est un revisionnage s'il n'est pas le premier du film, y
  // compris quand le premier est sur une page plus ancienne.
  const [cards, entries, firsts] = await Promise.all([
    getFilmCards(watches.map((w) => w.tmdbId)),
    prisma.userFilm.findMany({
      where: { userId, tmdbId: { in: tmdbIds } },
      select: { tmdbId: true, rating: true, runtime: true },
    }),
    prisma.filmWatch.findMany({
      where: { userId, tmdbId: { in: watches.map((w) => w.tmdbId) } },
      orderBy: [{ watchedAt: "asc" }, { createdAt: "asc" }, { id: "asc" }],
      distinct: ["tmdbId"],
      select: { id: true },
    }),
  ]);
  const ratingOf = new Map(entries.map((e) => [e.tmdbId, e.rating]));
  const runtimeOf = new Map(entries.map((e) => [e.tmdbId, e.runtime ?? 0]));
  const firstIds = new Set(firsts.map((f) => f.id));

  // ——— Chiffres de l'année ———
  const minutes = (list: { tmdbId: number }[]) => list.reduce((s, w) => s + (runtimeOf.get(w.tmdbId) ?? 0), 0);
  const yearMinutes = minutes(yearWatches);
  const stats = [
    { label: `Visionnages ${year}`, value: yearWatches.length },
    { label: "Ce mois-ci", value: yearWatches.filter((w) => w.watchedAt >= monthStart).length },
    { label: "Films différents", value: new Set(yearWatches.map((w) => w.tmdbId)).size },
    { label: "Devant l'écran", value: yearMinutes > 0 ? formatHours(yearMinutes) : "—" },
  ];

  const counts = new Map<string, number>();
  for (const w of yearWatches) counts.set(dayKey(w.watchedAt), (counts.get(dayKey(w.watchedAt)) ?? 0) + 1);
  const grid = yearGrid(year, counts, today);

  // Faits marquants, à côté de la frise
  const byMonth = new Map<number, number>();
  for (const w of yearWatches) byMonth.set(w.watchedAt.getUTCMonth(), (byMonth.get(w.watchedAt.getUTCMonth()) ?? 0) + 1);
  const bestMonth = [...byMonth].sort((a, b) => b[1] - a[1])[0];
  const bestDay = [...counts].sort((a, b) => b[1] - a[1])[0];

  // ——— Regroupement par mois, dans l'ordre d'affichage ———
  const months: { key: string; name: string; year: number; items: typeof watches }[] = [];
  for (const w of watches) {
    const key = w.watchedAt.toISOString().slice(0, 7);
    if (months.at(-1)?.key !== key) {
      months.push({ key, name: MONTH_NAME.format(w.watchedAt), year: w.watchedAt.getUTCFullYear(), items: [] });
    }
    months.at(-1)!.items.push(w);
  }

  return (
    <div className={styles.page}>
      <div className={styles.head}>
        <div className={styles.sectionSub}>Bibliothèque</div>
        <h2 className={styles.sectionTitle}>Journal</h2>
        <p className={styles.lead}>
          Chaque visionnage daté, revisionnages compris. {total} au total.
        </p>
      </div>

      {total === 0 ? (
        <div className={styles.empty}>
          <p>Votre journal est vide.</p>
          <p className={styles.emptyHint}>
            Sur la fiche d&apos;un film, « Vu aujourd&apos;hui » l&apos;y ajoute.
          </p>
        </div>
      ) : (
        <>
          <div className={styles.stats}>
            {stats.map((s) => (
              <div key={s.label} className={styles.stat}>
                <span className={styles.statVal}>{s.value}</span>
                <span className={styles.statLab}>{s.label}</span>
              </div>
            ))}
          </div>

          {/* L'année en un coup d'œil */}
          <section className={styles.yearCard}>
            <div className={styles.yearHead}>
              <span className={styles.eyebrow}>{year} en un coup d&apos;œil</span>
              <span className={styles.legend}>
                Moins
                {[0, 1, 2, 3].map((l) => (
                  <i key={l} className={styles[`lvl${l}`]} />
                ))}
                Plus
              </span>
            </div>
            <div className={styles.yearBody}>
            <div className={styles.yearScroll}>
              <div className={styles.yearGrid} style={{ gridTemplateColumns: `repeat(${grid.weeks.length}, minmax(0, 1fr))` }}>
                {grid.months.map((m) => (
                  <span key={m.label} className={styles.monthLabel} style={{ gridColumn: m.col + 1 }}>
                    {m.label}
                  </span>
                ))}
                {grid.weeks.map((week, w) =>
                  week.map((d, i) => (
                    <span
                      key={d.key}
                      className={`${styles.day} ${!d.inYear || d.future ? styles.dayOff : styles[`lvl${Math.min(d.count, 3)}`]} ${d.key === today ? styles.dayToday : ""}`}
                      style={{ gridColumn: w + 1, gridRow: i + 2 }}
                      title={d.inYear && !d.future ? `${DAY_FULL.format(new Date(`${d.key}T00:00:00Z`))} : ${d.count} film${d.count > 1 ? "s" : ""}` : undefined}
                    />
                  )),
                )}
              </div>
            </div>
            {bestMonth && (
              <dl className={styles.facts}>
                <div>
                  <dt>Mois record</dt>
                  <dd>
                    <span className={styles.factVal}>{MONTH_NAME.format(new Date(Date.UTC(year, bestMonth[0], 1)))}</span>
                    <span className={styles.factSub}>{bestMonth[1]} film{bestMonth[1] > 1 ? "s" : ""}</span>
                  </dd>
                </div>
                {bestDay && (
                  <div>
                    <dt>Jour record</dt>
                    <dd>
                      <span className={styles.factVal}>
                        {new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(`${bestDay[0]}T00:00:00Z`))}
                      </span>
                      <span className={styles.factSub}>{bestDay[1]} film{bestDay[1] > 1 ? "s" : ""} dans la journée</span>
                    </dd>
                  </div>
                )}
              </dl>
            )}
            </div>
          </section>

          {/* Mois par mois */}
          {months.map((month) => {
            const monthMinutes = minutes(month.items);
            return (
              <section key={month.key} className={styles.month}>
                <div className={styles.monthSide}>
                  <h3 className={styles.monthName}>{month.name}</h3>
                  {month.year !== year && <span className={styles.monthYear}>{month.year}</span>}
                  <span className={styles.monthMeta}>
                    {month.items.length} film{month.items.length > 1 ? "s" : ""}
                    {monthMinutes > 0 && ` • ${formatHours(monthMinutes)}`}
                  </span>
                </div>
                <ul className={styles.grid}>
                  {month.items.map((w, i) => {
                    const card = cards.get(w.tmdbId);
                    const rating = ratingOf.get(w.tmdbId);
                    return (
                      <li key={w.id}>
                        <Link href={`/film/${w.tmdbId}`} className={styles.card}>
                          <span className={styles.poster}>
                            {card?.posterUrl && (
                              <Image
                                src={card.posterUrl}
                                alt=""
                                fill
                                sizes="(max-width: 768px) 30vw, 160px"
                                style={{ objectFit: "cover" }}
                                loading={i < 6 ? "eager" : undefined}
                              />
                            )}
                            <span className={styles.date}>
                              <b>{w.watchedAt.getUTCDate()}</b>
                              {WEEKDAY.format(w.watchedAt).replace(".", "")}
                            </span>
                            {!firstIds.has(w.id) && <span className={styles.rewatch}>Revu</span>}
                          </span>
                          <span className={styles.title}>{card?.title ?? "Film inconnu"}</span>
                          <span className={styles.meta}>
                            {card?.year && <span>{card.year}</span>}
                            {card?.year && rating != null && <span>•</span>}
                            {rating != null && <span className={styles.stars}>★ <Rating value={rating} outOf /></span>}
                          </span>
                          {w.note && <span className={styles.note}>« {w.note} »</span>}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}

          {hasMore && (
            <div className={styles.more}>
              <Link href={`/films/journal?apres=${watches.at(-1)!.id}`} className={styles.moreBtn}>
                Plus anciens
              </Link>
            </div>
          )}
        </>
      )}
    </div>
  );
}
