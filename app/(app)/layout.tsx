import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";
import Sidebar from "./components/Sidebar";
import styles from "./app.module.css";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  return (
    <div className={styles.app}>
      <Sidebar userName={session.name} />
      <main className={styles.main}>{children}</main>
    </div>
  );
}
