"use client";

import { useState, useRef, useTransition } from "react";
import { updateProfile } from "@/app/actions/profile";
import styles from "./profile.module.css";

type Props = { name: string; bio: string; avatarUrl: string; bannerUrl: string };

export default function ProfileEditor({ name, bio, avatarUrl, bannerUrl }: Props) {
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

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>, type: "avatar" | "banner") => {
    const file = e.target.files?.[0];
    if (!file) return;
    const preview = URL.createObjectURL(file);
    if (type === "avatar") setAvatarPreview(preview);
    else setBannerPreview(preview);
  };

  const handleSave = () => {
    startTransition(async () => {
      const updates: Record<string, string> = { name: nameVal, bio: bioVal };

      if (avatarRef.current?.files?.[0]) {
        updates.avatarUrl = await uploadFile(avatarRef.current.files[0], "avatar");
      }
      if (bannerRef.current?.files?.[0]) {
        updates.bannerUrl = await uploadFile(bannerRef.current.files[0], "banner");
      }

      await updateProfile(updates);
      setSaved(true);
      setTimeout(() => { setSaved(false); setOpen(false); }, 800);
    });
  };

  return (
    <>
      <button className={styles.editBtn} onClick={() => setOpen(true)}>
        Modifier le profil
      </button>

      {open && (
        <div className={styles.overlay} onClick={(e) => e.target === e.currentTarget && setOpen(false)}>
          <div className={styles.modal}>
            <button className={styles.closeBtn} onClick={() => setOpen(false)}>✕</button>
            <div className={styles.modalTitle}>Modifier le profil</div>

            {/* Banner preview + upload */}
            <div
              className={styles.bannerPreview}
              style={bannerPreview ? { backgroundImage: `url("${bannerPreview}")` } : undefined}
              onClick={() => bannerRef.current?.click()}
            >
              <span className={styles.uploadHint}>Changer la bannière</span>
              <input ref={bannerRef} type="file" accept="image/*" hidden onChange={(e) => handleFileChange(e, "banner")} />
            </div>

            {/* Avatar preview + upload */}
            <div className={styles.avatarEditRow}>
              <div
                className={styles.avatarPreview}
                onClick={() => avatarRef.current?.click()}
              >
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
              <input
                className={styles.input}
                value={nameVal}
                onChange={(e) => setNameVal(e.target.value)}
                placeholder="Votre nom"
              />
            </div>

            <div className={styles.field}>
              <label className={styles.label}>Bio <span className={styles.optional}>(optionnel)</span></label>
              <textarea
                className={styles.textarea}
                value={bioVal}
                onChange={(e) => setBioVal(e.target.value)}
                placeholder="Quelques mots sur vous…"
                rows={3}
              />
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
