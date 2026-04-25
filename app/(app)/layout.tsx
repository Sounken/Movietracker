import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";
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
  if (!session) redirect("/login");

  const [watchlist, liked, filmEntries] = await Promise.all([
    prisma.userFilm.count({ where: { userId: session.userId, watchlist: true } }),
    prisma.userFilm.count({ where: { userId: session.userId, liked: true } }),
    prisma.userFilm.findMany({
      where: { userId: session.userId },
      select: { rating: true, review: true, liked: true, watched: true },
    }),
  ]);

  const levelInfo = getLevelInfo(computeXP(filmEntries));

  return (
    <div className={styles.app}>
      <Sidebar userName={session.name} counts={{ watchlist, liked }} levelInfo={levelInfo} />
      <main className={styles.main}>{children}</main>
    </div>
  );
}
