"use client";

import { useState } from "react";
import { Share2 } from "lucide-react";
import styles from "./bilan.module.css";

/**
 * Partage de l'image du bilan (format story).
 *
 * Sur téléphone, la feuille de partage du système (Instagram, WhatsApp…) ;
 * ailleurs, ou si le navigateur ne partage pas de fichier, un téléchargement.
 */
export default function BilanShare({ year }: { year: number }) {
  const [state, setState] = useState<"idle" | "busy" | "error">("idle");

  const share = async () => {
    setState("busy");
    try {
      const res = await fetch(`/api/bilan/image?annee=${year}`);
      if (!res.ok) throw new Error(String(res.status));
      const blob = await res.blob();
      const file = new File([blob], `movietracker-bilan-${year}.png`, { type: "image/png" });

      if (navigator.canShare?.({ files: [file] })) {
        try {
          await navigator.share({ files: [file], title: `Mon année ${year} sur MovieTracker` });
        } catch (err) {
          // Feuille de partage refermée : ce n'est pas une erreur.
          if ((err as Error).name !== "AbortError") throw err;
        }
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = file.name;
        a.click();
        URL.revokeObjectURL(url);
      }
      setState("idle");
    } catch {
      setState("error");
    }
  };

  return (
    <button type="button" className={styles.shareBtn} onClick={share} disabled={state === "busy"}>
      <Share2 size={14} />
      {state === "busy" ? "Préparation…" : state === "error" ? "Réessayer" : "Partager l'image"}
    </button>
  );
}
