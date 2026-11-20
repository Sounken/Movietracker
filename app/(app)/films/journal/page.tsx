import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import { getFilmCards } from "@/lib/films";
import { Rating } from "@/lib/rating-scale";
import styles from "./journal.module.css";

export const metadata: Metadata = { title: "Journal", robots: { index: false } };

const PAGE_SIZE = 100;

const MONTH = new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric", timeZone: "UTC" });
const WEEKDAY = new Intl.DateTimeFormat("fr-FR", { weekday: "short", timeZone: "UTC" });

export default async function JournalPage({
  searchParams,
}: {
  searchParams: Promise<{ apres?: string }>;
}) {
  const [session, { apres }] = await Promise.all([getSession(), searchParams]);
  if (!session) redirect("/login");
  const userId = session.userId;
  const yearStart = new Date(Date.UTC(new Date().getUTCFullYear(), 0, 1));

  // Pagination par curseur : « Plus anciens » repart de la dernière ligne
  // affichée. Un curseur inconnu ou d'un autre compte retombe sur le début.
  const cursor = apres
    ? await prisma.filmWatch.findFirst({ where: { id: apres, userId }, select: { id: true } })
    : null;

  const [rows, yearCount, total] = await Promise.all([
    prisma.filmWatch.findMany({
      where: { userId },
      orderBy: [{ watchedAt: "desc" }, { createdAt: "desc" }, { id: "desc" }],
      take: PAGE_SIZE + 1,
      ...(cursor ? { cursor: { id: cursor.id }, skip: 1 } : {}),
      select: { id: true, tmdbId: true, watchedAt: true, note: true, createdAt: true },
    }),
    prisma.filmWatch.count({ where: { userId, watchedAt: { gte: yearStart } } }),
    prisma.filmWatch.count({ where: { userId } }),
  ]);
  const hasMore = rows.length > PAGE_SIZE;
  const watches = rows.slice(0, PAGE_SIZE);
  const tmdbIds = [...new Set(watches.map((w) => w.tmdbId))];

  // Un visionnage est un revisionnage s'il n'est pas le premier du film, y
  // compris quand le premier est sur une page plus ancienne.
  const [cards, ratings, firsts] = await Promise.all([
    getFilmCards(tmdbIds),
    prisma.userFilm.findMany({
      where: { userId, tmdbId: { in: tmdbIds } },
      select: { tmdbId: true, rating: true },
    }),
    prisma.filmWatch.findMany({
      where: { userId, tmdbId: { in: tmdbIds } },
      orderBy: [{ watchedAt: "asc" }, { createdAt: "asc" }, { id: "asc" }],
      distinct: ["tmdbId"],
      select: { id: true },
    }),
  ]);
  const ratingOf = new Map(ratings.map((r) => [r.tmdbId, r.rating]));
  const firstIds = new Set(firsts.map((f) => f.id));

  // Regroupement par mois, dans l'ordre d'affichage.
  const months: { label: string; items: typeof watches }[] = [];
  for (const w of watches) {
    const label = MONTH.format(w.watchedAt);
    if (months.at(-1)?.label !== label) months.push({ label, items: [] });
    months.at(-1)!.items.push(w);
  }

  return (
    <div>

      <div className={styles.head}>
        <div className={styles.sectionSub}>Bibliothèque</div>
        <h2 className={styles.sectionTitle}>Journal</h2>
        {total > 0 && (
          <p className={styles.stats}>
            {yearCount} visionnage{yearCount > 1 ? "s" : ""} en {yearStart.getUTCFullYear()} •{" "}
            {total} au total
          </p>
        )}
      </div>

      {watches.length === 0 ? (
        <div className={styles.empty}>
          <p>Votre journal est vide.</p>
          <p className={styles.emptyHint}>
            Sur la fiche d&apos;un film, « Vu aujourd&apos;hui » ou « Autre date… » l&apos;y
            ajoute. Les revisionnages s&apos;y ajoutent avec « J&apos;ai revu ce film ».
          </p>
        </div>
      ) : (
        months.map((month) => (
          <section key={month.label} className={styles.month}>
            <h3 className={styles.monthTitle}>{month.label}</h3>
            <ul className={styles.list}>
              {month.items.map((w) => {
                const card = cards.get(w.tmdbId);
                const rating = ratingOf.get(w.tmdbId);
                return (
                  <li key={w.id}>
                    <Link href={`/film/${w.tmdbId}`} className={styles.row}>
                      <span className={styles.day}>
                        <span className={styles.dayNum}>{w.watchedAt.getUTCDate()}</span>
                        <span className={styles.dayName}>{WEEKDAY.format(w.watchedAt)}</span>
                      </span>
                      {card?.posterUrl ? (
                        <Image src={card.posterUrl} alt="" width={40} height={60} className={styles.poster} />
                      ) : (
                        <span className={styles.posterEmpty} />
                      )}
                      <span className={styles.info}>
                        <span className={styles.title}>
                          {card?.title ?? "Film inconnu"}
                          {card?.year && <span className={styles.year}>{card.year}</span>}
                        </span>
                        {w.note && <span className={styles.note}>{w.note}</span>}
                      </span>
                      {!firstIds.has(w.id) && <span className={styles.rewatch}>Revu</span>}
                      {rating != null && (
                        <span className={styles.rating}>★ <Rating value={rating} /></span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        ))
      )}

      {hasMore && (
        <div className={styles.more}>
          <Link href={`/films/journal?apres=${watches.at(-1)!.id}`} className={styles.moreBtn}>
            Plus anciens
          </Link>
        </div>
      )}
    </div>
  );
}
