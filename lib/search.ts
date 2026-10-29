/**
 * Normalisation et scoring de pertinence pour la recherche.
 *
 * La recherche TMDB est sensible à la ponctuation : « wall e » ne remonte pas
 * WALL·E, et « xmen » relègue X-Men (2000) en 7e position. On interroge donc
 * plusieurs variantes de la requête, puis on reclasse nous-mêmes les
 * résultats sur la pertinence plutôt que sur la seule popularité.
 */

/**
 * NFD ne décompose pas les ligatures : « cœur » perdait son « œ » avec la
 * ponctuation et devenait « cur », qui ne correspond plus à « coeur » tapé au
 * clavier.
 */
const LIGATURES: Record<string, string> = { "œ": "oe", "æ": "ae", "ß": "ss" };

function unligature(s: string): string {
  return s.replace(/[œæß]/g, (c) => LIGATURES[c]);
}

/** « X-Men » → « xmen », « WALL·E » → « walle », « Amélie » → « amelie ». */
export function normalize(s: string): string {
  return unligature((s ?? "").toLowerCase())
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

/** Découpe en mots normalisés : « The Dark Knight » → ["the","dark","knight"]. */
export function words(s: string): string[] {
  return unligature((s ?? "").toLowerCase())
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

/**
 * Variantes envoyées à TMDB. La forme compacte rattrape les requêtes dont la
 * ponctuation ne correspond pas au titre officiel (« wall e » → « walle »).
 *
 * La forme accordée vient d'une limite de TMDB : seul le dernier mot de la
 * requête peut n'être qu'un début de mot, les autres doivent correspondre en
 * entier. « coeur noir » ne trouvait donc pas la série « Cœurs Noirs », alors
 * que « coeurs noir » la trouve. On bascule les mots non finaux entre singulier
 * et pluriel ; une variante sans écho chez TMDB ne coûte qu'une liste vide.
 */
export function queryVariants(q: string): string[] {
  const raw = q.trim();
  const compact = normalize(raw);
  const split = words(raw);
  const spaced = split.join(" ");
  const inflected = split
    .map((w, i) =>
      i === split.length - 1 || w.length < 3 ? w : /[sx]$/.test(w) ? w.slice(0, -1) : `${w}s`,
    )
    .join(" ");
  // Set : inutile d'appeler TMDB deux fois quand les formes coïncident.
  return [...new Set([raw, compact, spaced, inflected])].filter((v) => v.length >= 2);
}

/**
 * Score de pertinence d'un titre face à la requête. Plus c'est haut, mieux
 * c'est ; 0 = aucun rapport, le résultat sera écarté.
 */
export function relevance(
  candidates: (string | null | undefined)[],
  query: string,
  /**
   * Pour une personne, un mot entier qui correspond vaut un match exact :
   * « nolan » est le nom de famille de Christopher Nolan. Pour un titre en
   * revanche, ce serait trop généreux — « Inside Christopher Nolan's
   * Oppenheimer » passerait devant le réalisateur lui-même.
   */
  isPerson = false,
): number {
  const nq = normalize(query);
  const qWords = words(query);
  if (!nq) return 0;

  let best = 0;
  for (const candidate of candidates) {
    if (!candidate) continue;
    const nt = normalize(candidate);
    const tWords = words(candidate);
    if (!nt) continue;

    let score = 0;
    if (nt === nq) score = 6;                                    // « xmen » = « X-Men »
    else if (isPerson && tWords.includes(nq)) score = 6;         // « nolan » = Christopher Nolan
    else if (nt.startsWith(nq)) score = 5;                       // « xmen » ⊂ « X-Men Apocalypse »
    else if (tWords.some((w) => w.startsWith(nq))) score = 4;
    else if (tWords.includes(nq)) score = 3;                     // mot cité en plein milieu du titre
    else if (nt.includes(nq)) score = 3;
    else if (qWords.length > 1 && qWords.every((w) => tWords.some((t) => t.startsWith(w)))) score = 2;
    else if (qWords.some((w) => w.length >= 3 && nt.includes(w))) score = 1;

    if (score > best) best = score;
  }
  return best;
}

/** À pertinence égale, on privilégie les films, puis les séries. */
export const MEDIA_PRIORITY: Record<string, number> = {
  movie: 0,
  tv: 1,
  person: 2,
  // Un studio est rarement ce qu'on cherche en tapant un titre : à pertinence
  // égale, il passe derrière les œuvres et les personnes.
  company: 3,
};

/**
 * Une œuvre confidentielle ou un homonyme inconnu ne doit pas coiffer une
 * référence célèbre juste parce que son titre correspond au caractère près :
 * sans ça, « nolan » remontait des acteurs anonymes avant Christopher Nolan.
 * On juge la notoriété au nombre de votes pour les œuvres (plus stable) et à
 * la popularité pour les personnes.
 */
const OBSCURITY_PENALTY = 2;

export function effectiveScore(r: {
  score: number;
  mediaType: string;
  popularity: number;
  votes?: number;
}): number {
  const obscure =
    r.mediaType === "person" ? r.popularity < 1 : (r.votes ?? 0) < 100;
  return r.score - (obscure ? OBSCURITY_PENALTY : 0);
}
