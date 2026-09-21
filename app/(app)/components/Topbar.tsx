"use client";

import { usePathname } from "next/navigation";
import SearchBox from "./SearchBox";
import NotificationsBell from "./NotificationsBell";
import styles from "./Topbar.module.css";

type Props = { greeting: string; userName: string | null };

export default function Topbar({ greeting, userName }: Props) {
  // Monde courant : la recherche s'y adapte (mêmes règles que la Sidebar).
  const pathname = usePathname();
  const isSeries = pathname === "/series" || pathname.startsWith("/series/");

  return (
    <div className={styles.topbar}>
      <div className={styles.greet}>
        {/* La ligne « En ligne • bonsoir » a été retirée : elle répétait en
            petit ce que le titre dit juste en dessous, et l'indicateur de
            statut n'apprenait rien — on ne consulte pas l'application en étant
            hors ligne. Le titre porte seul la salutation, désormais déclinée
            par tranche horaire (cf. lib/greeting.ts). */}
        <h1 className={styles.title}>
          {userName ? (
            <>
              {greeting}, <em>{userName}</em>.
            </>
          ) : (
            "Bienvenue"
          )}
        </h1>
      </div>

      <SearchBox scope={isSeries ? "series" : "films"} />

      {/* `userName` sert d'indice d'authentification : le prénom est exigé à
          l'inscription, et la barre ne le reçoit que pour une session ouverte.
          Un visiteur anonyme ne déclenche donc aucune requête. */}
      <NotificationsBell enabled={!!userName} buttonClassName={styles.iconBtn} />
    </div>
  );
}
