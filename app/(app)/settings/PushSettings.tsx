"use client";

import { useEffect, useState, useTransition } from "react";
import { updatePushPreferences, type PushPreferences } from "@/app/actions/settings";
import styles from "./settings.module.css";

const CATEGORIES: { key: keyof PushPreferences; label: string; hint: string }[] = [
  { key: "pushAvailable", label: "Disponibilité en streaming", hint: "Un film de « À voir » arrive sur une de vos plateformes." },
  { key: "pushReleases", label: "Sorties et épisodes", hint: "Un film attendu sort, un nouvel épisode d'une série suivie est diffusé." },
  { key: "pushSocial", label: "Réactions et abonnés", hint: "Quelqu'un réagit à votre activité ou s'abonne à vous." },
  { key: "pushFriends", label: "Activité des amis", hint: "Une personne que vous suivez note ou voit un film." },
];

type DeviceState = "loading" | "unsupported" | "ios-browser" | "denied" | "off" | "on";

function base64ToBytes(base64: string): Uint8Array<ArrayBuffer> {
  const padded = (base64 + "=".repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(padded);
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

/** iPhone / iPad dans Safari, hors de l'app ajoutée à l'écran d'accueil. */
function isIosBrowser(): boolean {
  const ios = /iPhone|iPad|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const standalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return ios && !standalone;
}

export default function PushSettings({ initialPreferences }: { initialPreferences: PushPreferences }) {
  const [device, setDevice] = useState<DeviceState>("loading");
  const [prefs, setPrefs] = useState(initialPreferences);
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    (async () => {
      if (isIosBrowser()) return setDevice("ios-browser");
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
        return setDevice("unsupported");
      }
      if (Notification.permission === "denied") return setDevice("denied");
      const registration = await navigator.serviceWorker.getRegistration();
      const subscription = await registration?.pushManager.getSubscription();
      setDevice(subscription && Notification.permission === "granted" ? "on" : "off");
    })().catch(() => setDevice("unsupported"));
  }, []);

  const enable = () =>
    startTransition(async () => {
      setMessage("");
      try {
        // La demande d'autorisation doit suivre un geste : c'est ce clic.
        const permission = await Notification.requestPermission();
        if (permission !== "granted") {
          setDevice(permission === "denied" ? "denied" : "off");
          return;
        }
        const registration = await navigator.serviceWorker.register("/sw.js");
        await navigator.serviceWorker.ready;
        const { publicKey } = await (await fetch("/api/push/key")).json();
        const subscription =
          (await registration.pushManager.getSubscription()) ??
          (await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: base64ToBytes(publicKey),
          }));
        const res = await fetch("/api/push/subscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(subscription.toJSON()),
        });
        if (!res.ok) throw new Error(String(res.status));
        setDevice("on");
      } catch {
        setMessage("Activation impossible sur cet appareil.");
      }
    });

  const disable = () =>
    startTransition(async () => {
      setMessage("");
      const registration = await navigator.serviceWorker.getRegistration();
      const subscription = await registration?.pushManager.getSubscription();
      if (subscription) {
        await fetch("/api/push/subscribe", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: subscription.endpoint }),
        });
        await subscription.unsubscribe();
      }
      setDevice("off");
    });

  const test = () =>
    startTransition(async () => {
      const res = await fetch("/api/push/test", { method: "POST" });
      const { sent } = res.ok ? await res.json() : { sent: 0 };
      setMessage(sent > 0 ? "Notification envoyée." : "Aucun appareil n'a pu être joint.");
    });

  const toggle = (key: keyof PushPreferences) => {
    const next = { ...prefs, [key]: !prefs[key] };
    setPrefs(next);
    startTransition(async () => {
      try {
        await updatePushPreferences({ [key]: next[key] });
      } catch {
        setPrefs(prefs);
      }
    });
  };

  return (
    <section className={styles.card}>
      <div className={styles.cardHead}>
        <h3 className={styles.cardTitle}>Notifications</h3>
        <span className={styles.status} aria-live="polite">{message}</span>
      </div>

      {device === "ios-browser" ? (
        <div className={styles.callout}>
          <strong>Sur iPhone, ajoutez d&apos;abord MovieTracker à l&apos;écran d&apos;accueil.</strong>
          <ol>
            <li>Touchez le bouton Partager de Safari.</li>
            <li>Choisissez « Sur l&apos;écran d&apos;accueil ».</li>
            <li>Ouvrez MovieTracker depuis la nouvelle icône, puis revenez ici.</li>
          </ol>
          <span>Apple ne permet les notifications qu&apos;aux sites installés ainsi (iOS 16.4 ou plus récent).</span>
        </div>
      ) : device === "unsupported" ? (
        <p className={styles.cardText}>Ce navigateur ne gère pas les notifications push.</p>
      ) : device === "denied" ? (
        <p className={styles.cardText}>
          Les notifications sont bloquées pour ce site. Autorisez-les dans les réglages du
          navigateur, puis rechargez la page.
        </p>
      ) : (
        <div className={styles.deviceRow}>
          <p className={styles.cardText}>
            {device === "on"
              ? "Activées sur cet appareil."
              : "Recevez les sorties, les nouveaux épisodes et les réactions même application fermée."}
          </p>
          {device === "on" ? (
            <div className={styles.deviceActions}>
              <button type="button" className={styles.btn} onClick={test} disabled={isPending}>
                Tester
              </button>
              <button type="button" className={styles.btn} onClick={disable} disabled={isPending}>
                Désactiver ici
              </button>
            </div>
          ) : (
            <button
              type="button"
              className={`${styles.btn} ${styles.btnAccent}`}
              onClick={enable}
              disabled={isPending || device === "loading"}
            >
              {isPending ? "Activation…" : "Activer sur cet appareil"}
            </button>
          )}
        </div>
      )}

      <ul className={styles.switches}>
        {CATEGORIES.map((c) => (
          <li key={c.key} className={styles.switchRow}>
            <span>
              <span className={styles.switchLabel}>{c.label}</span>
              <span className={styles.switchHint}>{c.hint}</span>
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={prefs[c.key]}
              aria-label={c.label}
              className={`${styles.switch} ${prefs[c.key] ? styles.switchOn : ""}`}
              onClick={() => toggle(c.key)}
            >
              <span className={styles.switchThumb} />
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
