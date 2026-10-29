"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { headers } from "next/headers";
import * as Sentry from "@sentry/nextjs";
import { prisma } from "@/lib/db";
import { createSession, deleteSession } from "@/lib/session";
import {
  allowResetRequest,
  findUserByEmail,
  findValidResetToken,
  hashToken,
  sendResetLink,
} from "@/lib/password-reset";

export type AuthState = { error?: string } | undefined;

export async function register(
  state: AuthState,
  formData: FormData
): Promise<AuthState> {
  const name = formData.get("name") as string;
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  if (!name || !email || !password) {
    return { error: "Tous les champs sont requis." };
  }
  if (password.length < 8) {
    return { error: "Le mot de passe doit contenir au moins 8 caractères." };
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return { error: "Email déjà utilisé." };
  }

  const passwordHash = await bcrypt.hash(password, 12);
  await prisma.user.create({ data: { name, email, passwordHash } });

  redirect("/login");
}

export async function login(
  state: AuthState,
  formData: FormData
): Promise<AuthState> {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  if (!email || !password) {
    return { error: "Tous les champs sont requis." };
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    return { error: "Identifiants incorrects." };
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    return { error: "Identifiants incorrects." };
  }

  await createSession(user.id, user.name, user.sessionVersion);
  redirect("/");
}

export async function logout() {
  await deleteSession();
  redirect("/login");
}

export type ResetRequestState = { sent?: boolean; error?: string } | undefined;

/**
 * Demande de lien de réinitialisation.
 *
 * La réponse est la même, que l'adresse corresponde à un compte ou non : un
 * message différent permettrait de tester quelles adresses sont inscrites.
 * Pour la même raison, la création du lien et l'envoi partent après la
 * réponse (`after`) — sinon le temps de réponse, plus long quand un e-mail
 * part, trahirait l'existence du compte. Un échec d'envoi remonte à GlitchTip.
 */
export async function requestPasswordReset(
  state: ResetRequestState,
  formData: FormData,
): Promise<ResetRequestState> {
  const email = String(formData.get("email") ?? "").trim();
  if (!email) return { error: "Indiquez votre adresse e-mail." };

  const h = await headers();
  const ip = h.get("x-real-ip")?.trim() || h.get("x-forwarded-for")?.split(",")[0]?.trim() || "inconnue";
  if (!allowResetRequest(ip)) {
    return { error: "Trop de demandes. Réessayez dans quelques minutes." };
  }

  after(async () => {
    try {
      const user = await findUserByEmail(email);
      if (user) await sendResetLink(user);
    } catch (e) {
      Sentry.captureException(e);
    }
  });

  return { sent: true };
}

export type ResetState = { error?: string; done?: boolean } | undefined;

/**
 * Nouveau mot de passe à partir d'un lien reçu par e-mail.
 *
 * Incrémenter `sessionVersion` déconnecte tous les appareils, celui-ci
 * compris : on se reconnecte avec le nouveau mot de passe. Le jeton est
 * consommé dans la même transaction que la mise à jour, et le décompte de la
 * suppression garantit qu'un même lien ne sert qu'une fois, même cliqué deux
 * fois en même temps.
 */
export async function resetPassword(state: ResetState, formData: FormData): Promise<ResetState> {
  const token = String(formData.get("token") ?? "");
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  if (password.length < 8) {
    return { error: "Le mot de passe doit contenir au moins 8 caractères." };
  }
  if (password !== confirm) {
    return { error: "Les deux mots de passe ne correspondent pas." };
  }

  const record = await findValidResetToken(token);
  if (!record) return { error: "Ce lien n'est plus valable. Faites une nouvelle demande." };

  const passwordHash = await bcrypt.hash(password, 12);
  const updated = await prisma.$transaction(async (tx) => {
    const { count } = await tx.passwordResetToken.deleteMany({
      where: { tokenHash: hashToken(token), expiresAt: { gt: new Date() } },
    });
    if (count === 0) return false;
    await tx.user.update({
      where: { id: record.userId },
      data: { passwordHash, sessionVersion: { increment: 1 } },
    });
    await tx.passwordResetToken.deleteMany({ where: { userId: record.userId } });
    return true;
  });

  // Pas de `deleteSession()` ici : toucher un cookie dans l'action fait
  // recharger la page par Next, qui revérifie le lien — désormais consommé —
  // et remplace la confirmation par « lien plus valable ». Inutile de toute
  // façon : l'incrément de version invalide déjà la session de cet appareil.
  if (!updated) return { error: "Ce lien n'est plus valable. Faites une nouvelle demande." };
  return { done: true };
}
