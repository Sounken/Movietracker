"use client";

import { useState, useRef, useTransition } from "react";
import { updateProfile } from "@/app/actions/profile";
import type { LevelInfo } from "@/lib/xp";
import styles from "./profile.module.css";

const PencilIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" width="14" height="14">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4Z" />
  </svg>
);

type Props = {
  name: string;
  bio: string;
  avatarUrl: string;
  bannerUrl: string;
  initial: string;
  levelInfo: LevelInfo;
  joinedYear: number;
};

export default function ProfileHeaderClient({
  name, bio, avatarUrl, bannerUrl, initial, levelInfo, joinedYear,
}: Props) {
  const [open, setOpen] = useState(false);
  const [nameVal, setNameVal] = useState(name);
  const [bioVal, setBioVal] = useState(bio);
  const [avatarPreview, setAvatarPreview] = useState(avatarUrl);
  const [bannerPreview, setBannerPreview] = useState(bannerUrl);
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  const avatarRef = useRef<HTMLInputElement>(null);
  const bannerRef = useRef<HTMLInputElement>(null);

  const uploadFile = async (file: File, type: "avatar" | "banner"): Promise<string> => {
    const form = new FormData();
    form.append("file", file);
    form.append("type", type);
    const res = await fetch("/api/upload", { method: "POST", body: form });
    const { url } = await res.json();
    return url as string;
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, type: "avatar" | "banner") => {
    const file = e.target.files?.[0];
    if (!file) return;
    const preview = URL.createObjectURL(file);
    if (type === "avatar") setAvatarPreview(preview);
    else setBannerPreview(preview);
  };

  const handleSave = () => {
    startTransition(async () => {
      const updates: Record<string, string> = { name: nameVal, bio: bioVal };
      if (avatarRef.current?.files?.[0])
        updates.avatarUrl = await uploadFile(avatarRef.current.files[0], "avatar");
      if (bannerRef.current?.files?.[0])
        updates.bannerUrl = await uploadFile(bannerRef.current.files[0], "banner");
      await updateProfile(updates);
      setSaved(true);
      setTimeout(() => { setSaved(false); setOpen(false); }, 800);
    });
  };

  return (
    <>
      {/* Banner */}
      <div
        className={styles.banner}
        style={bannerUrl ? { backgroundImage: `url("${bannerUrl}")` } : undefined}
        onClick={() => setOpen(true)}
      >
        <div className={styles.bannerGrain} />
        <div className={styles.bannerOverlay} />
        <div className={styles.bannerHint}>✎ Modifier la bannière</div>
      </div>

      {/* Profile header */}
      <div className={styles.profileHeader}>
        <div className={styles.profileHeaderInner}>
          {/* Avatar */}
          <div className={styles.avatarWrap} onClick={() => setOpen(true)}>
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatarUrl} alt={name} className={styles.avatar} />
            ) : (
              <div className={styles.avatarFallback}>
                {initial}
              </div>
            )}
            <div className={styles.avatarEditOverlay}>Modifier</div>
            <div className={styles.levelCircle}>{levelInfo.level}</div>
          </div>

          {/* Name + badges */}
          <div className={styles.nameBlock}>
            <h1 className={styles.name}>{name || "Cinéphile"}</h1>
            <div className={styles.metaRow}>
              <span className={styles.profileBadge}>
                ✦ {levelInfo.title}
              </span>
              <span className={styles.joinedDate}>Membre depuis {joinedYear}</span>
            </div>
            {bio && <p className={styles.bio}>{bio}</p>}
          </div>

          {/* Edit button */}
          <div className={styles.profileActions}>
            <button className={styles.btnEdit} onClick={() => setOpen(true)}>
              <PencilIcon />
              <span className={styles.btnEditLabel}>Modifier le profil</span>
            </button>
          </div>
        </div>
      </div>

      {/* XP section */}
      <div className={styles.xpSection}>
        <div className={styles.xpRow}>
          <span className={styles.xpLabel}>{levelInfo.title} · niveau {levelInfo.level}</span>
          <span className={styles.xpVal}>{levelInfo.currentXP} / {levelInfo.nextLevelXP} XP</span>
        </div>
        <div className={styles.xpBarBg}>
          <div className={styles.xpBarFill} style={{ width: `${levelInfo.percent}%` }} />
        </div>
        <div className={styles.xpMilestones}>
          <span>Niv. {levelInfo.level}</span>
          <span>+{levelInfo.nextLevelXP - levelInfo.currentXP} XP pour le niv. {levelInfo.level + 1}</span>
          <span>Niv. {levelInfo.level + 1}</span>
        </div>
      </div>

      {/* Edit modal */}
      {open && (
        <div className={styles.overlay} onClick={(e) => e.target === e.currentTarget && setOpen(false)}>
          <div className={styles.modal}>
            <button className={styles.closeBtn} onClick={() => setOpen(false)}>✕</button>
            <div className={styles.modalTitle}>Modifier le profil</div>

            <div
              className={styles.bannerPreview}
              style={bannerPreview ? { backgroundImage: `url("${bannerPreview}")` } : undefined}
              onClick={() => bannerRef.current?.click()}
            >
              <span className={styles.uploadHint}>Changer la bannière</span>
              <input ref={bannerRef} type="file" accept="image/*" hidden onChange={(e) => handleFileChange(e, "banner")} />
            </div>

            <div className={styles.avatarEditRow}>
              <div className={styles.avatarPreview} onClick={() => avatarRef.current?.click()}>
                {avatarPreview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={avatarPreview} alt="" className={styles.avatarImg} />
                ) : (
                  <span className={styles.avatarInitial}>{nameVal[0]?.toUpperCase() ?? "?"}</span>
                )}
                <span className={styles.avatarOverlay}>📷</span>
                <input ref={avatarRef} type="file" accept="image/*" hidden onChange={(e) => handleFileChange(e, "avatar")} />
              </div>
              <div className={styles.avatarEditInfo}>Cliquez pour changer la photo de profil</div>
            </div>

            <div className={styles.field}>
              <label className={styles.label}>Nom affiché</label>
              <input className={styles.input} value={nameVal} onChange={(e) => setNameVal(e.target.value)} placeholder="Votre nom" />
            </div>

            <div className={styles.field}>
              <label className={styles.label}>Bio <span className={styles.optional}>(optionnel)</span></label>
              <textarea className={styles.textarea} value={bioVal} onChange={(e) => setBioVal(e.target.value)} placeholder="Quelques mots sur vous…" rows={3} />
            </div>

            <button className={styles.saveBtn} onClick={handleSave} disabled={isPending || saved}>
              {saved ? "✓ Sauvegardé !" : isPending ? "Enregistrement…" : "Sauvegarder"}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
