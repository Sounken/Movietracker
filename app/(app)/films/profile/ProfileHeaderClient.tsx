"use client";

import { useState, useRef, useEffect, useTransition, type ReactNode } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { X, Camera, Check, Sparkles, Pencil } from "lucide-react";
import { updateProfile } from "@/app/actions/profile";
import { getRanks, type LevelInfo } from "@/lib/xp";
import ImageCropper from "./ImageCropper";
import RanksModal from "./RanksModal";
import type { RatingScale } from "@/lib/rating";
import styles from "./profile.module.css";

const BIO_MAX_LENGTH = 1000;

// Ratios calés sur l'affichage réel : la bannière fait ~1400×240 sur desktop,
// l'avatar est un cercle. Recadrer à ces ratios évite que le navigateur
// recoupe l'image lui-même (background-size: cover) et déplace le sujet.
const BANNER_ASPECT = 5.5;
const BANNER_OUTPUT_WIDTH = 1600;
const AVATAR_ASPECT = 1;
const AVATAR_OUTPUT_WIDTH = 512;

const PencilIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" width="14" height="14">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4Z" />
  </svg>
);

const TrashIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" width="14" height="14">
    <path d="M3 6h18" />
    <path d="M8 6V4h8v2" />
    <path d="M19 6l-1 15H6L5 6" />
    <path d="M10 11v6M14 11v6" />
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
  /** Échelle de notation enregistrée (10 ou 100). */
  ratingScale: RatingScale;
  /** Boutons additionnels alignés à droite, à côté de « Modifier le profil »
   *  (ex. l'import Letterboxd sur le profil films). */
  extraActions?: ReactNode;
};

export default function ProfileHeaderClient({
  name, bio, avatarUrl, bannerUrl, initial, levelInfo, joinedYear, ratingScale, extraActions,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [ranksOpen, setRanksOpen] = useState(false);
  const [nameVal, setNameVal] = useState(name);
  const [bioVal, setBioVal] = useState(bio.slice(0, BIO_MAX_LENGTH));
  const [scaleVal, setScaleVal] = useState<RatingScale>(ratingScale);
  const [avatarPreview, setAvatarPreview] = useState(avatarUrl);
  const [bannerPreview, setBannerPreview] = useState(bannerUrl);
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  // Fichiers déjà recadrés, prêts à être envoyés. On ne se sert plus de
  // input.files : ce qui part au serveur est le rendu du recadrage.
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  // Fichier en cours de recadrage (null = éditeur fermé).
  const [cropping, setCropping] = useState<{ file: File; type: "avatar" | "banner" } | null>(null);

  const avatarRef = useRef<HTMLInputElement>(null);
  const bannerRef = useRef<HTMLInputElement>(null);
  // URLs d'aperçu créées localement, à libérer pour ne pas fuiter.
  const previewUrls = useRef<string[]>([]);

  useEffect(() => () => {
    previewUrls.current.forEach((u) => URL.revokeObjectURL(u));
  }, []);

  const makePreview = (file: File) => {
    const url = URL.createObjectURL(file);
    previewUrls.current.push(url);
    return url;
  };

  const uploadFile = async (file: File, type: "avatar" | "banner"): Promise<string> => {
    const form = new FormData();
    form.append("file", file);
    form.append("type", type);
    const res = await fetch("/api/upload", { method: "POST", body: form });
    const data: { url?: string; error?: string } = await res
      .json()
      .catch(() => ({ error: "Réponse d'upload invalide" }));
    if (!res.ok || !data.url) {
      throw new Error(data.error ?? "Upload impossible");
    }
    const { url } = data;
    return url as string;
  };

  // Choisir un fichier ouvre l'éditeur de recadrage plutôt que d'accepter
  // l'image telle quelle.
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, type: "avatar" | "banner") => {
    const file = e.target.files?.[0];
    // On vide l'input tout de suite : sinon re-choisir le même fichier après
    // une annulation ne déclencherait plus d'événement change.
    e.target.value = "";
    if (!file) return;
    setError("");
    setCropping({ file, type });
  };

  const handleCropped = (croppedFile: File) => {
    if (!cropping) return;
    const preview = makePreview(croppedFile);
    if (cropping.type === "avatar") {
      setAvatarFile(croppedFile);
      setAvatarPreview(preview);
    } else {
      setBannerFile(croppedFile);
      setBannerPreview(preview);
    }
    setCropping(null);
  };

  const clearAvatar = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    if (avatarRef.current) avatarRef.current.value = "";
    setAvatarFile(null);
    setAvatarPreview("");
  };

  const clearBanner = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    if (bannerRef.current) bannerRef.current.value = "";
    setBannerFile(null);
    setBannerPreview("");
  };

  const handleSave = () => {
    setError("");
    startTransition(async () => {
      try {
        const updates: {
          name: string;
          bio: string;
          ratingScale: RatingScale;
          avatarUrl?: string;
          bannerUrl?: string;
        } = {
          name: nameVal,
          bio: bioVal.slice(0, BIO_MAX_LENGTH),
          ratingScale: scaleVal,
        };
        if (avatarFile) updates.avatarUrl = await uploadFile(avatarFile, "avatar");
        else if (!avatarPreview && avatarUrl) updates.avatarUrl = "";
        if (bannerFile) updates.bannerUrl = await uploadFile(bannerFile, "banner");
        else if (!bannerPreview && bannerUrl) updates.bannerUrl = "";
        await updateProfile(updates);
        setSaved(true);
        router.refresh();
        setTimeout(() => { setSaved(false); setOpen(false); }, 800);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Enregistrement impossible");
      }
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
        <div className={styles.bannerHint}><Pencil size={12} /> Modifier la bannière</div>
      </div>

      {/* Profile header */}
      <div className={styles.profileHeader}>
        <div className={styles.profileHeaderInner}>
          {/* Avatar */}
          <div className={styles.avatarWrap} onClick={() => setOpen(true)}>
            {avatarUrl ? (
              <Image src={avatarUrl} alt={name} className={styles.avatar} width={120} height={120} />
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
              <button
                type="button"
                className={styles.profileBadge}
                onClick={() => setRanksOpen(true)}
                title="Voir tous les rangs et votre progression"
              >
                <Sparkles size={11} /> {levelInfo.title}
                <span className={styles.profileBadgeLevel}>niv. {levelInfo.level}</span>
              </button>
              <span className={styles.joinedDate}>Membre depuis {joinedYear}</span>
            </div>
            {bio && <p className={styles.bio}>{bio}</p>}
          </div>

          {/* Actions — toutes sur la même ligne, alignées à droite */}
          <div className={styles.profileActions}>
            <button className={styles.btnEdit} onClick={() => setOpen(true)}>
              <PencilIcon />
              <span className={styles.btnEditLabel}>Modifier le profil</span>
            </button>
            {extraActions}
          </div>
        </div>
      </div>

      {/* XP section */}
      <div className={styles.xpSection}>
        <div className={styles.xpRow}>
          <span className={styles.xpLabel}>{levelInfo.title} • niveau {levelInfo.level}</span>
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

      {ranksOpen && (
        <RanksModal
          ranks={getRanks(levelInfo.totalXP)}
          levelInfo={levelInfo}
          onClose={() => setRanksOpen(false)}
        />
      )}

      {/* Edit modal */}
      {open && (
        <div className={styles.overlay} onClick={(e) => e.target === e.currentTarget && setOpen(false)}>
          <div className={styles.modal}>
            <button className={styles.closeBtn} onClick={() => setOpen(false)}><X size={15} /></button>
            <div className={styles.modalTitle}>Modifier le profil</div>

            <div
              className={styles.bannerPreview}
              style={bannerPreview ? { backgroundImage: `url("${bannerPreview}")` } : undefined}
              onClick={() => bannerRef.current?.click()}
            >
              {bannerPreview && (
                <button
                  type="button"
                  className={styles.bannerRemoveBtn}
                  onClick={clearBanner}
                  aria-label="Supprimer la bannière"
                  title="Supprimer la bannière"
                >
                  <TrashIcon />
                </button>
              )}
              <span className={styles.uploadHint}>Changer la bannière</span>
              <input ref={bannerRef} type="file" accept="image/*" hidden onChange={(e) => handleFileChange(e, "banner")} />
            </div>

            <div className={styles.avatarEditRow}>
              <div className={styles.avatarPreview} onClick={() => avatarRef.current?.click()}>
                {avatarPreview ? (
                  <Image src={avatarPreview} alt="" className={styles.avatarImg} width={72} height={72} unoptimized />
                ) : (
                  <span className={styles.avatarInitial}>{nameVal[0]?.toUpperCase() ?? "?"}</span>
                )}
                <span className={styles.avatarOverlay}><Camera size={20} /></span>
                {avatarPreview && (
                  <button
                    type="button"
                    className={styles.avatarRemoveBtn}
                    onClick={clearAvatar}
                    aria-label="Supprimer la photo de profil"
                    title="Supprimer la photo de profil"
                  >
                    <TrashIcon />
                  </button>
                )}
                <input ref={avatarRef} type="file" accept="image/*" hidden onChange={(e) => handleFileChange(e, "avatar")} />
              </div>
              <div className={styles.avatarEditInfo}>
                Cliquez sur la photo pour la remplacer. Vous pourrez la recadrer
                et zoomer avant de valider.
              </div>
            </div>

            <div className={styles.field}>
              <label className={styles.label}>Nom affiché</label>
              <input className={styles.input} value={nameVal} onChange={(e) => setNameVal(e.target.value)} placeholder="Votre nom" />
            </div>

            <div className={styles.field}>
              <div className={styles.labelRow}>
                <label className={styles.label}>Bio <span className={styles.optional}>(optionnel)</span></label>
                <span className={styles.charCount}>{bioVal.length}/{BIO_MAX_LENGTH}</span>
              </div>
              <textarea
                className={styles.textarea}
                value={bioVal}
                onChange={(e) => setBioVal(e.target.value.slice(0, BIO_MAX_LENGTH))}
                placeholder="Quelques mots sur vous…"
                rows={5}
                maxLength={BIO_MAX_LENGTH}
              />
            </div>

            {/* Réglage global : change l'affichage des notes partout dans
                l'app. Les notes déjà saisies sont converties (8.5 → 85), rien
                n'est perdu si on revient sur /10. */}
            <div className={styles.field}>
              <label className={styles.label}>Échelle de notation</label>
              <div className={styles.scaleChoice}>
                {([10, 100] as const).map((s) => (
                  <button
                    key={s}
                    type="button"
                    className={`${styles.scaleBtn} ${scaleVal === s ? styles.scaleBtnOn : ""}`}
                    onClick={() => setScaleVal(s)}
                    aria-pressed={scaleVal === s}
                  >
                    <span className={styles.scaleBtnVal}>/{s}</span>
                    <span className={styles.scaleBtnHint}>
                      {s === 10 ? "Étoiles et demi-étoiles" : "Note exacte au point près"}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {error && <div className={styles.modalError}>{error}</div>}

            <button className={styles.saveBtn} onClick={handleSave} disabled={isPending || saved}>
              {saved ? <><Check size={15} /> Sauvegardé !</> : isPending ? "Enregistrement…" : "Sauvegarder"}
            </button>
          </div>
        </div>
      )}

      {/* Éditeur de recadrage — s'ouvre par-dessus la modale de profil */}
      {cropping && (
        <ImageCropper
          file={cropping.file}
          aspect={cropping.type === "avatar" ? AVATAR_ASPECT : BANNER_ASPECT}
          outputWidth={cropping.type === "avatar" ? AVATAR_OUTPUT_WIDTH : BANNER_OUTPUT_WIDTH}
          title={cropping.type === "avatar" ? "Recadrer la photo de profil" : "Recadrer la bannière"}
          round={cropping.type === "avatar"}
          onCancel={() => setCropping(null)}
          onDone={handleCropped}
        />
      )}
    </>
  );
}
