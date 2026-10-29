import "server-only";

/**
 * Envoi d'e-mails transactionnels, par l'API HTTP de Resend.
 *
 * Un simple `fetch` plutôt que le SDK : un seul point d'appel, aucune
 * dépendance à maintenir. L'adresse d'expédition doit appartenir au domaine
 * vérifié dans Resend (movietracker.fr), sinon l'API refuse l'envoi.
 *
 * Sans clé, en développement, le contenu part dans la console : c'est ce qui
 * permet de tester le parcours de bout en bout sans compte. En production,
 * une clé absente est une erreur — elle remonte à GlitchTip au lieu de
 * passer pour un envoi réussi.
 */
type Mail = { to: string; subject: string; html: string; text: string };

const DEFAULT_FROM = "MovieTracker <noreply@movietracker.fr>";

export async function sendMail(mail: Mail): Promise<void> {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    if (process.env.NODE_ENV !== "production") {
      console.info(`[mail] (non envoyé, RESEND_API_KEY absente) à ${mail.to} — ${mail.subject}\n${mail.text}`);
      return;
    }
    throw new Error("RESEND_API_KEY absente : e-mail non envoyé");
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: process.env.MAIL_FROM ?? DEFAULT_FROM,
      to: [mail.to],
      subject: mail.subject,
      html: mail.html,
      text: mail.text,
    }),
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Resend a refusé l'envoi (${res.status}) : ${await res.text()}`);
  }
}
