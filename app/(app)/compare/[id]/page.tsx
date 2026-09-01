import Image from "next/image";
import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import { compareFilms } from "@/lib/compare";
import { Rating } from "@/lib/rating-scale";
import Topbar from "../../components/Topbar";
import CompareClient from "./CompareClient";
import styles from "./compare.module.css";

function Avatar({ url, name }: { url: string | null; name: string }) {
  if (url) {
    return <Image src={url} alt={name} width={64} height={64} className={styles.avatar} />;
  }
  return <div className={styles.avatarFallback}>{name[0]?.toUpperCase()}</div>;
}

export default async function ComparePage({ params }: { params: Promise<{ id: string }> }) {
  const [session, { id: theirId }] = await Promise.all([getSession(), params]);
  if (!session) redirect("/login");

  // Se comparer à soi-même n'a pas de sens : on renvoie sur sa collection.
  if (theirId === session.userId) redirect("/films/profile");

  const [me, them] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.userId },
      select: { name: true, email: true, avatarUrl: true },
    }),
    prisma.user.findUnique({
      where: { id: theirId },
      select: { name: true, email: true, avatarUrl: true },
    }),
  ]);

  if (!me || !them) notFound();

  const result = await compareFilms(session.userId, theirId);

  const myName = me.name ?? me.email.split("@")[0];
  const theirName = them.name ?? them.email.split("@")[0];

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Bonjour" : hour < 18 ? "Bon après-midi" : "Bonsoir";

  return (
    <div className={styles.page}>
      <Topbar greeting={greeting} userName={session.name} />

      <div className={styles.header}>
        <div className={styles.headerSub}>Social — Comparaison</div>
        <h1 className={styles.headerTitle}>Vos goûts face à ceux de {theirName}</h1>
      </div>

      <div className={styles.versus}>
        <div className={styles.side}>
          <Avatar url={me.avatarUrl} name={myName} />
          <div className={styles.sideName}>{myName}</div>
          <div className={styles.sideAvg}>
            {result.myTotal} films
            {result.myAverage !== null && <> • ★ <Rating value={result.myAverage} /></>}
          </div>
        </div>

        <div className={styles.vs}>vs</div>

        <div className={styles.side}>
          <Avatar url={them.avatarUrl} name={theirName} />
          <div className={styles.sideName}>{theirName}</div>
          <div className={styles.sideAvg}>
            {result.theirTotal} films
            {result.theirAverage !== null && <> • ★ <Rating value={result.theirAverage} /></>}
          </div>
        </div>
      </div>

      <div className={styles.stats}>
        <div className={styles.stat}>
          <div className={styles.statLab}>Affinité</div>
          <div className={styles.statVal}>
            {result.affinity !== null ? `${result.affinity}%` : "—"}
          </div>
          <div className={styles.gauge}>
            <div className={styles.gaugeFill} style={{ width: `${result.affinity ?? 0}%` }} />
          </div>
        </div>

        <div className={styles.stat}>
          <div className={styles.statLab}>Films en commun</div>
          <div className={styles.statVal}>{result.common.length}</div>
          <div className={styles.statSub}>notés par vous deux</div>
        </div>

        <div className={styles.stat}>
          <div className={styles.statLab}>Écart moyen</div>
          <div className={styles.statVal}>
            <Rating value={result.meanGap} />
          </div>
          <div className={styles.statSub}>sur chaque film commun</div>
        </div>

        <div className={styles.stat}>
          <div className={styles.statLab}>Accords parfaits</div>
          <div className={styles.statVal}>{result.exactMatches}</div>
          <div className={styles.statSub}>note identique</div>
        </div>
      </div>

      <CompareClient common={result.common} mediaBase="/film" />
    </div>
  );
}
