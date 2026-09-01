import { NextRequest, NextResponse } from "next/server";

/**
 * Relais des événements du SDK client vers GlitchTip.
 *
 * Pourquoi ce détour : les bloqueurs de publicité interceptent les requêtes de
 * supervision sur le **motif d'URL**, pas seulement sur le domaine.
 * `/api/1/envelope/?sentry_version=7&sentry_key=…` est une signature reconnue
 * par les listes de filtrage, et l'auto-hébergement n'y change rien — testé,
 * la requête revenait en `net::ERR_BLOCKED_BY_CLIENT`. Toutes les erreurs des
 * utilisateurs équipés d'un bloqueur étaient perdues, silencieusement.
 *
 * L'option `tunnelRoute` de `@sentry/nextjs` fait exactement ça, mais elle est
 * implémentée par le greffon webpack et Next 16 compile avec Turbopack : elle
 * est ignorée sans avertissement. D'où cette route écrite à la main, branchée
 * via l'option d'exécution `tunnel` du SDK, qui elle ne dépend pas du bundler.
 *
 * Le nom `mn` est volontairement dénué de sens : « monitoring », « telemetry »,
 * « analytics » ou « collect » figurent tous dans les listes de filtrage, et
 * nommer la route explicitement reviendrait à la faire bloquer aussi.
 */

const DSN = process.env.NEXT_PUBLIC_SENTRY_DSN;

export async function POST(request: NextRequest) {
  // Sans DSN configuré, rien à relayer. On répond succès pour ne pas faire
  // boucler le SDK sur une erreur de transport.
  if (!DSN) return new NextResponse(null, { status: 204 });

  const envelope = await request.text();

  // Une enveloppe Sentry commence par une ligne d'en-tête JSON qui porte le DSN
  // d'origine ; le reste est opaque et transmis tel quel.
  const firstLineEnd = envelope.indexOf("\n");
  if (firstLineEnd === -1) {
    return NextResponse.json({ error: "Enveloppe malformée" }, { status: 400 });
  }

  let header: { dsn?: unknown };
  try {
    header = JSON.parse(envelope.slice(0, firstLineEnd));
  } catch {
    return NextResponse.json({ error: "En-tête illisible" }, { status: 400 });
  }

  if (typeof header.dsn !== "string") {
    return NextResponse.json({ error: "DSN absent" }, { status: 400 });
  }

  let target: URL;
  let expected: URL;
  try {
    target = new URL(header.dsn);
    expected = new URL(DSN);
  } catch {
    return NextResponse.json({ error: "DSN invalide" }, { status: 400 });
  }

  /**
   * Garde-fou indispensable : sans cette comparaison, n'importe qui pourrait
   * poster une enveloppe portant un DSN arbitraire et se servir de notre
   * serveur comme relais ouvert vers la destination de son choix.
   */
  if (target.host !== expected.host) {
    return NextResponse.json({ error: "Destination refusée" }, { status: 403 });
  }

  const projectId = target.pathname.replace(/^\/+/, "");
  if (!/^\d+$/.test(projectId)) {
    return NextResponse.json({ error: "Projet invalide" }, { status: 400 });
  }

  /**
   * Les paramètres d'authentification sont reconstruits depuis le DSN.
   *
   * Le navigateur les plaçait dans l'URL — `?sentry_version=7&sentry_key=…` —
   * et les omettre faisait refuser l'enveloppe par GlitchTip. La clé publique
   * est la partie « utilisateur » du DSN : `https://<clé>@hôte/<projet>`.
   */
  const endpoint = new URL(`${target.origin}/api/${projectId}/envelope/`);
  endpoint.searchParams.set("sentry_version", "7");
  endpoint.searchParams.set("sentry_key", target.username);

  let upstream: Response;
  try {
    upstream = await fetch(endpoint, {
      method: "POST",
      body: envelope,
      headers: { "Content-Type": "application/x-sentry-envelope" },
    });
  } catch (error) {
    // Le conteneur doit joindre GlitchTip par son URL publique, ce qui suppose
    // que le VPS accepte de reboucler sur sa propre IP depuis Docker. Si ce
    // n'est pas le cas, l'échec se manifeste ici.
    console.error("[tunnel] injoignable :", error);
    return new NextResponse(null, { status: 502 });
  }

  if (!upstream.ok) {
    // Le corps de la réponse porte le motif du refus. Journalisé côté serveur
    // plutôt que renvoyé au navigateur : c'est une information de diagnostic,
    // elle n'a rien à faire dans une réponse publique.
    const detail = await upstream.text().catch(() => "");
    console.error(`[tunnel] refus ${upstream.status} de GlitchTip :`, detail.slice(0, 500));
    return new NextResponse(null, { status: 502 });
  }

  return new NextResponse(null, { status: 204 });
}
