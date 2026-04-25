import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import Sidebar from "./components/Sidebar";
import styles from "./app.module.css";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const [watchlist, liked] = await Promise.all([
    prisma.userFilm.count({ where: { userId: session.userId, watchlist: true } }),
    prisma.userFilm.count({ where: { userId: session.userId, liked: true } }),
  ]);

  return (
    <div className={styles.app}>
      <Sidebar userName={session.name} counts={{ watchlist, liked }} />
      <main className={styles.main}>{children}</main>
    </div>
  );
}
