import { NextRequest, NextResponse } from "next/server";
import { decrypt } from "@/lib/session";
import { discoverQuery, parseDiscoverParams } from "@/lib/discover-params";

// Routes nécessitant une connexion. /films et /series (accueils) + discover/trends
// restent publics ; seules les pages perso sont protégées.
const privateRoutes = [
  "/films/lists", "/films/journal", "/films/bilan", "/films/calendrier", "/films/watchlist", "/films/favorites", "/films/profile",
  "/series/lists", "/series/calendrier", "/series/watchlist", "/series/favorites", "/series/profile",
  "/friends", "/series/friends", "/settings",
];

function isPrivateRoute(path: string): boolean {
  return privateRoutes.some(route => path === route || path.startsWith(route + "/"));
}

/**
 * Fiches alimentées par TMDB : film, série, acteur, société.
 *
 * Elles forment un graphe fermé du catalogue — une fiche film lie une vingtaine
 * d'acteurs et ses sociétés de production, chaque acteur des dizaines de films
 * — soit des millions d'URL atteignables par de simples liens. Un robot entré
 * par une seule fiche peut les parcourir sans fin. Constaté le 2026-09-15 :
 * environ 15 000 fiches par jour chargées par un visiteur anonyme, chacune
 * coûtant jusqu'à une douzaine d'appels TMDB et Wikidata.
 *
 * Seules les fiches à identifiant numérique sont visées : `/series/discover`,
 * `/series/trends` ou `/series/user/…` ne font pas partie du graphe.
 */
const DETAIL_ROUTE = /^\/(?:film|series|actor|company)\/\d+(?:\/|$)/;

/**
 * Limite de débit par adresse : un quota sur une fenêtre longue, et un plafond
 * de rafale sur une fenêtre courte.
 *
 * Compteurs en mémoire du processus, suffisants tant qu'un seul conteneur sert
 * l'application — c'est le cas depuis le passage à un nom de conteneur
 * statique dans Coolify.
 */
type Limit = {
  /** Nom porté par le journal des refus. */
  name: string;
  windowMs: number;
  maxPerWindow: number;
  burstWindowMs: number;
  maxPerBurst: number;
};

/**
 * Fiches, pour les visiteurs non connectés.
 *
 * `robots.txt` écarte les robots qui le respectent ; ceci est le filet pour
 * les autres. Soixante pages en cinq minutes, c'est une toutes les cinq
 * secondes pendant cinq minutes d'affilée : aucun humain ne navigue ainsi. Les
 * utilisateurs connectés ne sont jamais comptés.
 *
 * Plafond de rafale en plus : le robot observé en novembre 2026 restait sous
 * les soixante fiches par cinq minutes, mais par salves — jusqu'à douze fiches
 * distinctes dans la même seconde, soit plus de cent appels TMDB d'un coup, et
 * des centaines d'erreurs 429 pour lui comme pour les visiteurs présents. Huit
 * chargements de page en dix secondes, c'est déjà ouvrir une fiche toutes les
 * secondes en tapant l'adresse : la navigation dans l'application n'est pas
 * comptée.
 */
const DETAIL_LIMIT: Limit = {
  name: "fiches",
  windowMs: 5 * 60 * 1000,
  maxPerWindow: 60,
  burstWindowMs: 10 * 1000,
  maxPerBurst: 8,
};

/**
 * Routes qui coûtent cher à chaque appel, quel que soit le visiteur : rendu
 * complet de « Découvrir » et « Tendances », API qui interrogent TMDB (ou la
 * base, pour le Moviedle). Mesuré le 2026-11-16 : 90 requêtes par seconde
 * pendant 90 s depuis une seule adresse, toutes servies, et les visiteurs
 * présents attendaient jusqu'à 41 s.
 *
 * Contrairement aux fiches, les connectés sont comptés aussi (un compte se
 * crée en une minute) et les requêtes émises par une page ouverte également :
 * les seuils sont donc larges. Défilement infini, frappe dans la recherche ou
 * changement de filtre restent bien en dessous — une requête par seconde
 * soutenue, quelques-unes en rafale.
 */
const COSTLY_ROUTE =
  /^\/(?:(?:films|series)\/(?:discover|trends)|api\/(?:search|discover|company|puzzle\/search))(?:\/|$)/;

const COSTLY_LIMIT: Limit = {
  name: "routes coûteuses",
  windowMs: 60 * 1000,
  maxPerWindow: 120,
  burstWindowMs: 10 * 1000,
  maxPerBurst: 30,
};

/**
 * Optimiseur d'images : il ne sert plus que nos avatars et bannières, mais
 * une page d'amis peut en demander plusieurs dizaines d'un coup au premier
 * affichage (le navigateur les garde ensuite). D'où une limite à part, plus
 * large que celle des routes coûteuses.
 */
const IMAGE_ROUTE = /^\/_next\/image(?:\/|$)/;

const IMAGE_LIMIT: Limit = {
  name: "images",
  windowMs: 60 * 1000,
  maxPerWindow: 600,
  burstWindowMs: 10 * 1000,
  maxPerBurst: 150,
};

type LimitEntry = {
  count: number;
  resetAt: number;
  burst: number;
  burstResetAt: number;
  reported: boolean;
};

/** Un compteur par limite : une adresse a un quota distinct pour chacune. */
const hits = new Map<Limit, Map<string, LimitEntry>>();

/**
 * Adresse du client. Le proxy de Coolify (Traefik) écarte les en-têtes
 * `X-Forwarded-*` reçus de l'extérieur et pose les siens : la première entrée
 * est donc celle qu'il a vue, pas une valeur choisie par le client.
 */
function clientIp(request: NextRequest): string {
  return (
    request.headers.get("x-real-ip")?.trim() ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "inconnue"
  );
}

/**
 * Requête émise par une page déjà ouverte, et non chargement d'une page.
 *
 * Ce sont les seules à épargner : une fiche film affichée fait précharger par
 * `<Link>` les fiches liées qui entrent à l'écran, et chaque clic d'un humain
 * passe par une requête RSC. Faire défiler un casting en déclencherait des
 * dizaines en quelques secondes.
 *
 * **Les en-têtes du routeur ne sont pas utilisables ici.** Next retire `rsc`,
 * `next-router-prefetch` et `next-router-segment-prefetch` de la requête avant
 * de la confier au proxy (`FLIGHT_HEADERS` dans `server/web/adapter.js`) — une
 * première version s'appuyait dessus et limitait les préchargements comme des
 * visites, ce que le test local a révélé.
 *
 * `Sec-Fetch-Dest` est posé par le navigateur lui-même et ne peut pas être
 * modifié par le JavaScript d'une page : `document` pour un chargement de page,
 * `empty` pour un `fetch` — ce qu'est une requête RSC. Un robot qui charge les
 * fiches une à une envoie `document` s'il pilote un vrai navigateur, rien du
 * tout s'il est un simple script : dans les deux cas il est compté.
 *
 * Limite assumée : un robot qui naviguerait *à l'intérieur* de l'application,
 * de clic en clic, échapperait au compteur. Celui observé chargeait chaque
 * fiche directement — 35 000 chargements de page pour neuf navigations.
 *
 * Les pré-rendus spéculatifs du navigateur (`Sec-Purpose: prefetch`) sont
 * aussi épargnés : ils visent un document, mais aucun humain ne l'a demandé.
 */
function isInPageRequest(request: NextRequest): boolean {
  return (
    request.headers.get("sec-fetch-dest") === "empty" ||
    /prefetch/i.test(request.headers.get("sec-purpose") ?? request.headers.get("purpose") ?? "")
  );
}

function hitLimit(limit: Limit, ip: string, now: number) {
  let table = hits.get(limit);
  if (!table) {
    table = new Map();
    hits.set(limit, table);
  }

  // Purge des fenêtres expirées, déclenchée sur seuil : sans elle, la table
  // grossirait avec chaque adresse vue depuis le démarrage.
  if (table.size > 5_000) {
    for (const [key, entry] of table) {
      if (entry.resetAt <= now) table.delete(key);
    }
  }

  let entry = table.get(ip);
  if (!entry || entry.resetAt <= now) {
    entry = {
      count: 0,
      resetAt: now + limit.windowMs,
      burst: 0,
      burstResetAt: now + limit.burstWindowMs,
      reported: false,
    };
    table.set(ip, entry);
  }
  if (entry.burstResetAt <= now) {
    entry.burst = 0;
    entry.burstResetAt = now + limit.burstWindowMs;
  }
  entry.count++;
  entry.burst++;
  return entry;
}

/** Compte la requête ; renvoie la réponse 429 si l'adresse a dépassé la limite. */
function enforceLimit(limit: Limit, request: NextRequest): NextResponse | null {
  const now = Date.now();
  const ip = clientIp(request);
  const entry = hitLimit(limit, ip, now);

  const overWindow = entry.count > limit.maxPerWindow;
  const overBurst = entry.burst > limit.maxPerBurst;
  if (!overWindow && !overBurst) return null;

  // Journalisé une fois par fenêtre, pas à chaque refus : c'est ce qui
  // permet d'identifier le robot dans les journaux du conteneur sans les
  // noyer sous des milliers de lignes identiques.
  if (!entry.reported) {
    entry.reported = true;
    console.warn(
      `[proxy] limite ${limit.name} atteinte (${overWindow ? "fenêtre" : "rafale"}) : ip=${ip} ua="${request.headers.get("user-agent") ?? ""}"`,
    );
  }
  return new NextResponse("Trop de requêtes. Réessayez dans quelques minutes.", {
    status: 429,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Retry-After": String(Math.ceil(((overWindow ? entry.resetAt : entry.burstResetAt) - now) / 1000)),
      // Un refus ne doit jamais être gardé par un cache intermédiaire.
      "Cache-Control": "no-store",
    },
  });
}

export default async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;

  // Avant tout le reste, session comprise : un refus doit coûter le moins
  // possible.
  const costlyLimit = IMAGE_ROUTE.test(path) ? IMAGE_LIMIT : COSTLY_ROUTE.test(path) ? COSTLY_LIMIT : null;
  if (costlyLimit) {
    const refused = enforceLimit(costlyLimit, request);
    if (refused) return refused;
  }
  // Ni l'optimiseur d'images ni les API ne relèvent de la suite (fiches,
  // pages privées).
  if (path.startsWith("/api/") || IMAGE_ROUTE.test(path)) return NextResponse.next();

  // Filtres de « Découvrir » invalides : redirection vers l'adresse nettoyée,
  // ici et non dans la page. La page est rendue en flux (`loading.tsx`) : un
  // `redirect()` y arrive après l'envoi des en-têtes et devient un 200 de
  // 45 Ko avec une balise meta refresh, squelette rendu pour rien.
  const discoverMedia = path === "/films/discover" ? "movie" : path === "/series/discover" ? "tv" : null;
  if (discoverMedia) {
    const { params, valid } = parseDiscoverParams((k) => request.nextUrl.searchParams.get(k), discoverMedia);
    if (!valid) return NextResponse.redirect(new URL(`${path}${discoverQuery(params)}`, request.nextUrl));
  }

  const session = request.cookies.get("session")?.value;
  const payload = await decrypt(session);

  if (!payload && DETAIL_ROUTE.test(path) && !isInPageRequest(request)) {
    const refused = enforceLimit(DETAIL_LIMIT, request);
    if (refused) return refused;
  }

  if (isPrivateRoute(path) && !payload) {
    return NextResponse.redirect(new URL("/films/discover", request.nextUrl));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|.*\\.png$|favicon.ico).*)",
    // Pour la limite de débit seulement (cf. COSTLY_ROUTE, IMAGE_ROUTE).
    "/api/search",
    "/api/discover/:path*",
    "/api/company/:path*",
    "/api/puzzle/search",
    "/_next/image",
  ],
};
