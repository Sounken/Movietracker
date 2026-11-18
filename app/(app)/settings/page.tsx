import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { getUserWatchProviders } from "@/lib/user-settings";
import SettingsClient from "./SettingsClient";

export const metadata: Metadata = {
  title: "Réglages",
  robots: { index: false },
};

export default async function SettingsPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const watchProviders = await getUserWatchProviders(session.userId);

  return <SettingsClient watchProviders={watchProviders} />;
}
