"use client";

import { useState } from "react";
import Image from "next/image";
import { Play } from "lucide-react";
import type { TmdbVideo } from "@/lib/tmdb";
import styles from "./TrailerSection.module.css";

/**
 * Bande-annonce YouTube.
 *
 * L'iframe n'est montée qu'au clic : intégrer un lecteur YouTube au chargement
 * coûte plusieurs centaines de kilo-octets et pose des cookies tiers avant
 * même que l'utilisateur ait demandé à voir la vidéo. Tant qu'il ne clique
 * pas, on n'affiche que la vignette (servie par YouTube, sans cookie).
 */
export default function TrailerSection({
  video,
  title,
  sectionClassName,
  titleClassName,
}: {
  video: TmdbVideo;
  title: string;
  sectionClassName: string;
  titleClassName: string;
}) {
  const [playing, setPlaying] = useState(false);

  return (
    <div className={sectionClassName}>
      <div className={titleClassName}>
        {video.type === "Teaser" ? "Teaser" : "Bande-annonce"}
      </div>

      <div className={styles.frame}>
        {playing ? (
          <iframe
            className={styles.player}
            src={`https://www.youtube-nocookie.com/embed/${video.key}?autoplay=1`}
            title={video.name || `Bande-annonce de ${title}`}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        ) : (
          <button
            type="button"
            className={styles.poster}
            onClick={() => setPlaying(true)}
            aria-label={`Lire la bande-annonce de ${title}`}
          >
            <Image
              src={`https://i.ytimg.com/vi/${video.key}/hqdefault.jpg`}
              alt=""
              fill
              sizes="(max-width: 900px) 100vw, 720px"
              style={{ objectFit: "cover" }}
            />
            <span className={styles.play}>
              <Play size={22} fill="currentColor" />
            </span>
            {video.name && <span className={styles.caption}>{video.name}</span>}
          </button>
        )}
      </div>
    </div>
  );
}
