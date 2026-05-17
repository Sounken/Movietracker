import { getSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import Sidebar from "./components/Sidebar";
import styles from "./app.module.css";
import { computeXP, getLevelInfo } from "@/lib/xp";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();

  const [watchlist, liked, filmEntries, user] = session
    ? await Promise.all([
        prisma.userFilm.count({ where: { userId: session.userId, watchlist: true } }),
        prisma.userFilm.count({ where: { userId: session.userId, liked: true } }),
        prisma.userFilm.findMany({
          where: { userId: session.userId },
          select: { rating: true, review: true, liked: true, watched: true },
        }),
        prisma.user.findUnique({
          where: { id: session.userId },
          select: { avatarUrl: true },
        }),
      ])
    : [0, 0, [], null];

  const levelInfo = getLevelInfo(computeXP(filmEntries as { rating: number | null; review: string | null; liked: boolean; watched: boolean }[]));

  return (
    <div className={styles.app}>
      <Sidebar
        isAuthenticated={!!session}
        userName={session?.name ?? null}
        avatarUrl={user?.avatarUrl ?? null}
        counts={{ watchlist: watchlist as number, liked: liked as number }}
        levelInfo={levelInfo}
      />
      <main className={styles.main}>{children}</main>
    </div>
  );
}
