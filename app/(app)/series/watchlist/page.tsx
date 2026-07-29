import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import { getSeriesCards } from "@/lib/series";
import Topbar from "../../components/Topbar";
import SeriesCollectionClient from "../../components/SeriesCollectionClient";
import discover from "../../films/discover/discover.module.css";

export default async function SeriesWatchlistPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const [entries, total] = await Promise.all([
    prisma.userSeries.findMany({
      where: { userId: session.userId, watchlist: true },
      orderBy: { updatedAt: "desc" },
      take: 24,
      select: { tmdbId: true, rating: true },
    }),
    prisma.userSeries.count({ where: { userId: session.userId, watchlist: true } }),
  ]);

  const cards = await getSeriesCards(entries.map((e) => e.tmdbId));
  const items = entries
    .map((e) => {
      const c = cards.get(e.tmdbId);
      return c
        ? { id: c.id, name: c.name, posterUrl: c.posterUrl, year: c.year, voteAverage: c.voteAverage, rating: e.rating }
        : null;
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Bonjour" : hour < 18 ? "Bon après-midi" : "Bonsoir";

  return (
    <div className={discover.page}>
      <Topbar greeting={greeting} userName={session.name ?? null} />
      <div className={discover.header}>
        <div className={discover.sectionSub}>À voir</div>
        <h2 className={discover.sectionTitle}>Ma watchlist séries</h2>
      </div>
      <SeriesCollectionClient
        initialItems={items}
        total={total}
        type="watchlist"
        emptyTitle="Aucune série dans la watchlist."
      />
    </div>
  );
}
