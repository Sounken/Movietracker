"use client";

import { useState } from "react";

/**
 * Affiche le logo officiel du film à la place du titre.
 * Retombe sur le titre texte si aucun logo, ou si l'image échoue au chargement.
 */
export default function FilmTitleLogo({
  logoUrl,
  title,
  titleClassName,
  logoClassName,
}: {
  logoUrl: string | null;
  title: string;
  titleClassName: string;
  logoClassName: string;
}) {
  const [broken, setBroken] = useState(false);

  if (logoUrl && !broken) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={logoUrl}
        alt={title}
        className={logoClassName}
        onError={() => setBroken(true)}
      />
    );
  }

  const words = title.split(" ");
  return (
    <h1 className={titleClassName}>
      <em>{words[0]}</em>
      {words.length > 1 ? " " + words.slice(1).join(" ") : ""}
    </h1>
  );
}
