"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { followUser, unfollowUser } from "@/app/actions/friends";
import styles from "../../films/profile/profile.module.css";

export default function FollowButton({
  targetId,
  initialFollowing,
}: {
  targetId: string;
  initialFollowing: boolean;
}) {
  const [following, setFollowing] = useState(initialFollowing);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function toggle() {
    const was = following;
    setFollowing(!was); // optimiste

    startTransition(async () => {
      try {
        if (was) await unfollowUser(targetId);
        else await followUser(targetId);
        router.refresh();
      } catch {
        setFollowing(was); // rollback
      }
    });
  }

  return (
    <button className={styles.btnEdit} onClick={toggle} disabled={isPending}>
      <span className={styles.btnEditLabel}>
        {following ? "Se désabonner" : "S'abonner"}
      </span>
    </button>
  );
}
