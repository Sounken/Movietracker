import { NextRequest, NextResponse } from "next/server";
import { decrypt } from "@/lib/session";

// Routes nécessitant une connexion. /films et /series (accueils) + discover/trends
// restent publics ; seules les pages perso sont protégées.
const privateRoutes = [
  "/films/lists", "/films/watchlist", "/films/favorites", "/films/profile",
  "/series/lists", "/series/watchlist", "/series/favorites", "/series/profile",
  "/friends", "/series/friends",
];
const authRoutes = ["/login", "/register"];

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
 * Plafond de fiches par adresse, pour les visiteurs non connectés.
 *
 * `robots.txt` écarte les robots qui le respectent ; ceci est le filet pour
 * les autres. Soixante pages en cinq minutes, c'est une toutes les cinq
 * secondes pendant cinq minutes d'affilée : aucun humain ne navigue ainsi. Les
 * utilisateurs connectés ne sont jamais comptés.
 *
 * Compteur en mémoire du processus, suffisant tant qu'un seul conteneur sert
 * l'application — c'est le cas depuis le passage à un nom de conteneur
 * statique dans Coolify.
 */
const DETAIL_WINDOW_MS = 5 * 60 * 1000;
const DETAIL_MAX_PER_WINDOW = 60;
const detailHits = new Map<string, { count: number; resetAt: number; reported: boolean }>();

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

function hitDetailLimit(ip: string, now: number) {
  // Purge des fenêtres expirées, déclenchée sur seuil : sans elle, la table
  // grossirait avec chaque adresse vue depuis le démarrage.
  if (detailHits.size > 5_000) {
    for (const [key, entry] of detailHits) {
      if (entry.resetAt <= now) detailHits.delete(key);
    }
  }

  let entry = detailHits.get(ip);
  if (!entry || entry.resetAt <= now) {
    entry = { count: 0, resetAt: now + DETAIL_WINDOW_MS, reported: false };
    detailHits.set(ip, entry);
  }
  entry.count++;
  return entry;
}

export default async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;

  const session = request.cookies.get("session")?.value;
  const payload = await decrypt(session);

  if (!payload && DETAIL_ROUTE.test(path) && !isInPageRequest(request)) {
    const now = Date.now();
    const ip = clientIp(request);
    const entry = hitDetailLimit(ip, now);

    if (entry.count > DETAIL_MAX_PER_WINDOW) {
      // Journalisé une fois par fenêtre, pas à chaque refus : c'est ce qui
      // permet d'identifier le robot dans les journaux du conteneur sans les
      // noyer sous des milliers de lignes identiques.
      if (!entry.reported) {
        entry.reported = true;
        console.warn(
          `[proxy] limite de fiches atteinte : ip=${ip} ua="${request.headers.get("user-agent") ?? ""}"`,
        );
      }
      return new NextResponse("Trop de requêtes. Réessayez dans quelques minutes.", {
        status: 429,
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Retry-After": String(Math.ceil((entry.resetAt - now) / 1000)),
        },
      });
    }
  }

  if (isPrivateRoute(path) && !payload) {
    return NextResponse.redirect(new URL("/films/discover", request.nextUrl));
  }

  if (authRoutes.includes(path) && payload) {
    return NextResponse.redirect(new URL("/films", request.nextUrl));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|.*\\.png$|favicon.ico).*)"],
};
