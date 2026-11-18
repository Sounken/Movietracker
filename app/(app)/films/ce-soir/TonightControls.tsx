"use client";

import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { Check } from "lucide-react";
import type { Friend } from "@/lib/tonight";
import styles from "./ce-soir.module.css";

/** Choix du groupe et filtres, tenus dans l'URL : la page se partage telle quelle. */
export default function TonightControls({
  friends,
  selected,
  onPlatforms,
  maxRuntime,
  maxFriends,
  hasGroupProviders,
}: {
  friends: Friend[];
  selected: string[];
  onPlatforms: boolean;
  maxRuntime: number | null;
  maxFriends: number;
  hasGroupProviders: boolean;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const setParams = (updates: Record<string, string>) => {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(updates)) {
      if (value) params.set(key, value);
      else params.delete(key);
    }
    const q = params.toString();
    router.push(`/films/ce-soir${q ? `?${q}` : ""}`, { scroll: false });
  };

  const toggleFriend = (id: string) => {
    const next = selected.includes(id) ? selected.filter((s) => s !== id) : [...selected, id];
    setParams({ avec: next.join(",") });
  };

  return (
    <div className={styles.controls}>
      {friends.length > 0 && (
        <div className={styles.friends}>
          {friends.map((f) => {
            const on = selected.includes(f.id);
            const full = !on && selected.length >= maxFriends;
            return (
              <button
                key={f.id}
                type="button"
                className={`${styles.friend} ${on ? styles.friendOn : ""}`}
                onClick={() => toggleFriend(f.id)}
                disabled={full}
                aria-pressed={on}
                title={full ? `${maxFriends} amis au plus` : undefined}
              >
                {f.avatarUrl ? (
                  <Image src={f.avatarUrl} alt="" width={24} height={24} className={styles.friendAvatar} />
                ) : (
                  <span className={styles.friendAvatar}>{f.name.charAt(0).toUpperCase()}</span>
                )}
                {f.name}
                {on && <Check size={13} strokeWidth={3} />}
              </button>
            );
          })}
        </div>
      )}

      <div className={styles.filters}>
        <button
          type="button"
          className={`${styles.filter} ${onPlatforms ? styles.filterOn : ""}`}
          onClick={() => setParams({ plateformes: onPlatforms ? "" : "1" })}
          aria-pressed={onPlatforms}
          disabled={!hasGroupProviders && !onPlatforms}
          title={hasGroupProviders ? undefined : "Personne dans le groupe n'a renseigné ses plateformes (Réglages)"}
        >
          Sur nos plateformes
        </button>
        {[
          { value: null, label: "Toute durée" },
          { value: 105, label: "Moins de 1 h 45" },
          { value: 135, label: "Moins de 2 h 15" },
        ].map((d) => (
          <button
            key={d.label}
            type="button"
            className={`${styles.filter} ${maxRuntime === d.value ? styles.filterOn : ""}`}
            onClick={() => setParams({ duree: d.value ? String(d.value) : "" })}
            aria-pressed={maxRuntime === d.value}
          >
            {d.label}
          </button>
        ))}
      </div>
    </div>
  );
}
