import "server-only";

import { createHash, randomBytes } from "node:crypto";
import { prisma } from "./db";
import { sendMail } from "./mail";
import { SITE_NAME, SITE_URL } from "./site";

/** Durée de validité d'un lien. Assez pour aller lire ses mails, pas plus. */
const TOKEN_TTL_MS = 60 * 60 * 1000;

/** Liens envoyés au plus par compte et par heure : de quoi réessayer, pas de quoi inonder une boîte. */
const MAX_LINKS_PER_HOUR = 3;

/** Demandes au plus par adresse IP sur la fenêtre, tous comptes confondus. */
const IP_WINDOW_MS = 15 * 60 * 1000;
const MAX_REQUESTS_PER_IP = 5;

/**
 * Compteur en mémoire du processus, comme celui des fiches dans le proxy :
 * suffisant tant qu'un seul conteneur sert l'application.
 */
const ipHits = new Map<string, { count: number; resetAt: number }>();

export function allowResetRequest(ip: string): boolean {
  const now = Date.now();
  if (ipHits.size > 5_000) {
    for (const [key, entry] of ipHits) if (entry.resetAt <= now) ipHits.delete(key);
  }
  let entry = ipHits.get(ip);
  if (!entry || entry.resetAt <= now) {
    entry = { count: 0, resetAt: now + IP_WINDOW_MS };
    ipHits.set(ip, entry);
  }
  entry.count++;
  return entry.count <= MAX_REQUESTS_PER_IP;
}

/** Seule l'empreinte est stockée : la base ne contient aucun lien utilisable. */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Compte correspondant à l'adresse saisie.
 *
 * Les adresses sont enregistrées telles qu'elles ont été tapées à
 * l'inscription : « Damien@… » ne retrouverait pas « damien@… ». On tente la
 * forme exacte, puis une comparaison sans casse si elle ne désigne qu'un seul
 * compte — deux comptes homonymes à la casse près restent ambigus, on n'envoie
 * alors rien plutôt que de deviner.
 */
export async function findUserByEmail(email: string) {
  const select = { id: true, email: true, name: true } as const;
  const exact = await prisma.user.findUnique({ where: { email }, select });
  if (exact) return exact;
  const loose = await prisma.user.findMany({
    where: { email: { equals: email, mode: "insensitive" } },
    select,
    take: 2,
  });
  return loose.length === 1 ? loose[0] : null;
}

/** Jeton encore valable, ou `null` : inconnu, expiré, ou déjà utilisé (supprimé à l'usage). */
export async function findValidResetToken(token: string) {
  if (!token) return null;
  const record = await prisma.passwordResetToken.findUnique({
    where: { tokenHash: hashToken(token) },
    select: { id: true, userId: true, expiresAt: true },
  });
  if (!record || record.expiresAt <= new Date()) return null;
  return record;
}

/**
 * Crée un lien et l'envoie par e-mail.
 *
 * L'adresse du site vient de `SITE_URL` et jamais de l'en-tête `Host` de la
 * requête : celui-ci est choisi par le client, et un lien construit dessus
 * pourrait pointer vers un domaine piégé tout en partant de notre adresse.
 */
export async function sendResetLink(user: { id: string; email: string; name: string | null }) {
  const now = new Date();
  const recent = await prisma.passwordResetToken.count({
    where: { userId: user.id, createdAt: { gt: new Date(now.getTime() - 60 * 60 * 1000) } },
  });
  if (recent >= MAX_LINKS_PER_HOUR) return;

  await prisma.passwordResetToken.deleteMany({ where: { userId: user.id, expiresAt: { lte: now } } });

  const token = randomBytes(32).toString("base64url");
  await prisma.passwordResetToken.create({
    data: {
      userId: user.id,
      tokenHash: hashToken(token),
      expiresAt: new Date(now.getTime() + TOKEN_TTL_MS),
    },
  });

  const url = `${SITE_URL}/reset-password?token=${token}`;
  const hello = user.name ? `Bonjour ${user.name},` : "Bonjour,";

  await sendMail({
    to: user.email,
    subject: `Réinitialiser votre mot de passe ${SITE_NAME}`,
    text: [
      hello,
      "",
      `Une demande de réinitialisation du mot de passe a été faite pour votre compte ${SITE_NAME}.`,
      "Pour choisir un nouveau mot de passe, ouvrez ce lien (valable 1 heure) :",
      url,
      "",
      "Si vous n'êtes pas à l'origine de cette demande, ignorez ce message : votre mot de passe reste inchangé.",
    ].join("\n"),
    html: resetEmailHtml(hello, url),
  });
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

/** Mise en forme en styles en ligne : la plupart des messageries ignorent les feuilles de style. */
function resetEmailHtml(hello: string, url: string): string {
  const safeUrl = escapeHtml(url);
  return `<!doctype html>
<html lang="fr">
  <body style="margin:0;padding:24px;background:#0d0b0a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#f4ece2;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;margin:0 auto;background:#1a1614;border:1px solid #2a221f;border-radius:14px;">
      <tr><td style="padding:32px 28px;">
        <p style="margin:0 0 20px;font-size:20px;font-weight:600;">Movie<em style="color:#d97742;">tracker</em></p>
        <p style="margin:0 0 12px;font-size:15px;line-height:1.6;">${escapeHtml(hello)}</p>
        <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#a59689;">Une demande de réinitialisation du mot de passe a été faite pour votre compte. Le lien ci-dessous est valable <strong style="color:#f4ece2;">1 heure</strong>.</p>
        <p style="margin:0 0 24px;"><a href="${safeUrl}" style="display:inline-block;background:#d97742;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;padding:12px 22px;border-radius:10px;">Choisir un nouveau mot de passe</a></p>
        <p style="margin:0 0 8px;font-size:12px;line-height:1.6;color:#a59689;">Si le bouton ne fonctionne pas, copiez ce lien dans votre navigateur :</p>
        <p style="margin:0 0 24px;font-size:12px;line-height:1.6;word-break:break-all;"><a href="${safeUrl}" style="color:#f0a978;">${safeUrl}</a></p>
        <p style="margin:0;font-size:12px;line-height:1.6;color:#a59689;">Si vous n'êtes pas à l'origine de cette demande, ignorez ce message : votre mot de passe reste inchangé.</p>
      </td></tr>
    </table>
  </body>
</html>`;
}
