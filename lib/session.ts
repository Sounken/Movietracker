import "server-only";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import * as Sentry from "@sentry/nextjs";

export type SessionPayload = {
  userId: string;
  name: string | null;
  expiresAt: Date;
};

const secretKey = process.env.SESSION_SECRET;
const encodedKey = new TextEncoder().encode(secretKey);

export async function encrypt(payload: SessionPayload) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(encodedKey);
}

export async function decrypt(
  session: string | undefined = ""
): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(session, encodedKey, {
      algorithms: ["HS256"],
    });
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}

export async function createSession(userId: string, name: string | null) {
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const session = await encrypt({ userId, name, expiresAt });
  const cookieStore = await cookies();
  cookieStore.set("session", session, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    expires: expiresAt,
    sameSite: "lax",
    path: "/",
  });
}

export async function deleteSession() {
  const cookieStore = await cookies();
  cookieStore.delete("session");
}

/**
 * Session courante, et point de passage où l'on rattache l'utilisateur aux
 * erreurs remontées.
 *
 * Sans ça, un incident dit qu'une page a cassé, jamais pour qui : impossible de
 * distinguer un défaut qui touche tout le monde d'un cas lié à un compte — un
 * import Letterboxd particulier, une liste au contenu inattendu — ni de
 * répondre à quelqu'un qui signale un problème.
 *
 * **Seul l'identifiant est transmis.** Le nom est disponible ici, mais il n'a
 * pas à sortir vers un service tiers, fût-il le nôtre : l'identifiant suffit à
 * regrouper les erreurs d'un même compte et à le retrouver en base. C'est la
 * même logique que `scrubIPAddresses`, déjà actif sur le projet GlitchTip.
 *
 * `Sentry.setUser` écrit sur le scope d'isolation, que le SDK cloisonne par
 * requête : aucun risque qu'une session déborde sur la requête d'un autre.
 *
 * Le proxy, lui, passe par `decrypt` et non par cette fonction : il s'exécute
 * avant le rendu, sur chaque requête, et n'a pas à embarquer le SDK.
 */
export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const session = cookieStore.get("session")?.value;
  const payload = await decrypt(session);

  if (payload) Sentry.setUser({ id: payload.userId });

  return payload;
}
