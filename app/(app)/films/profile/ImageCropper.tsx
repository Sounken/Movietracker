"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { X, Check, RotateCcw, ZoomIn, ZoomOut } from "lucide-react";
import styles from "./ImageCropper.module.css";

type Props = {
  /** Fichier choisi par l'utilisateur, jamais envoyé tel quel au serveur. */
  file: File;
  /** Ratio largeur / hauteur du cadre (1 pour un avatar, ~5.5 pour la bannière). */
  aspect: number;
  /** Largeur maximale de l'image exportée, en pixels. */
  outputWidth: number;
  title: string;
  /** Affiche le cadre en cercle (avatar). Le recadrage reste carré. */
  round?: boolean;
  onCancel: () => void;
  onDone: (file: File) => void;
};

const MIN_ZOOM = 1;
const MAX_ZOOM = 4;
const MIN_OUTPUT_WIDTH = 240;
/** Fond appliqué avant le dessin : évite le noir sur les PNG transparents. */
const CANVAS_BACKGROUND = "#0d0b0a";

export default function ImageCropper({
  file,
  aspect,
  outputWidth,
  title,
  round = false,
  onCancel,
  onDone,
}: Props) {
  const frameRef = useRef<HTMLDivElement>(null);
  // URL + image décodée arrivent ensemble, une fois le chargement terminé.
  const [source, setSource] = useState<{ url: string; img: HTMLImageElement } | null>(null);
  const [frame, setFrame] = useState({ w: 0, h: 0 });
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // Position du pointeur + offset au début du glissé.
  const drag = useRef<{ px: number; py: number; ox: number; oy: number } | null>(null);

  // ——— Chargement de l'image choisie ———
  useEffect(() => {
    const objectUrl = URL.createObjectURL(file);
    const image = new window.Image();
    image.onload = () => setSource({ url: objectUrl, img: image });
    image.onerror = () => setError("Impossible de lire cette image.");
    image.src = objectUrl;
    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);

  // ——— Dimensions réelles du cadre (nécessaires pour toute la géométrie) ———
  // ResizeObserver déclenche déjà un premier appel au moment de observe(),
  // inutile de mesurer à la main.
  useEffect(() => {
    const el = frameRef.current;
    if (!el) return;
    const observer = new ResizeObserver(() =>
      setFrame({ w: el.clientWidth, h: el.clientHeight }),
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onCancel(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onCancel]);

  const url = source?.url ?? "";
  const img = source?.img ?? null;

  // Échelle « cover » : au zoom 1 l'image remplit exactement le cadre.
  const baseScale =
    img && frame.w > 0
      ? Math.max(frame.w / img.naturalWidth, frame.h / img.naturalHeight)
      : 1;
  const scale = baseScale * zoom;
  const drawnW = img ? img.naturalWidth * scale : 0;
  const drawnH = img ? img.naturalHeight * scale : 0;

  // L'image doit toujours couvrir le cadre : pas de bande vide sur les bords.
  const clampOffset = useCallback(
    (x: number, y: number, w: number, h: number) => ({
      x: Math.min(0, Math.max(frame.w - w, x)),
      y: Math.min(0, Math.max(frame.h - h, y)),
    }),
    [frame.w, frame.h],
  );

  // Recentrage quand l'image ou le cadre change de taille.
  const [centeredFor, setCenteredFor] = useState("");
  const centerKey = `${img?.src ?? ""}|${frame.w}x${frame.h}`;
  if (img && frame.w > 0 && centerKey !== centeredFor) {
    setCenteredFor(centerKey);
    setZoom(1);
    const w = img.naturalWidth * baseScale;
    const h = img.naturalHeight * baseScale;
    setOffset({ x: (frame.w - w) / 2, y: (frame.h - h) / 2 });
  }

  /** Zoom en gardant fixe le point de l'image situé au centre du cadre. */
  const applyZoom = (next: number) => {
    const z = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, next));
    if (!img || frame.w === 0) { setZoom(z); return; }
    const newScale = baseScale * z;
    const cx = (frame.w / 2 - offset.x) / scale;
    const cy = (frame.h / 2 - offset.y) / scale;
    setZoom(z);
    setOffset(
      clampOffset(
        frame.w / 2 - cx * newScale,
        frame.h / 2 - cy * newScale,
        img.naturalWidth * newScale,
        img.naturalHeight * newScale,
      ),
    );
  };

  // ——— Glisser (souris + tactile via Pointer Events) ———
  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!img) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { px: e.clientX, py: e.clientY, ox: offset.x, oy: offset.y };
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d) return;
    setOffset(
      clampOffset(d.ox + (e.clientX - d.px), d.oy + (e.clientY - d.py), drawnW, drawnH),
    );
  };

  const endDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    if (drag.current) e.currentTarget.releasePointerCapture(e.pointerId);
    drag.current = null;
  };

  const onWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    applyZoom(zoom * (e.deltaY < 0 ? 1.12 : 1 / 1.12));
  };

  const reset = () => {
    if (!img || frame.w === 0) return;
    setZoom(1);
    setOffset({
      x: (frame.w - img.naturalWidth * baseScale) / 2,
      y: (frame.h - img.naturalHeight * baseScale) / 2,
    });
  };

  // ——— Export : on redessine seulement la zone visible du cadre ———
  const handleValidate = async () => {
    if (!img || frame.w === 0) return;
    setBusy(true);
    setError("");
    try {
      // Rectangle source, exprimé dans les pixels d'origine de l'image.
      const sx = -offset.x / scale;
      const sy = -offset.y / scale;
      const sw = frame.w / scale;
      const sh = frame.h / scale;

      // On n'agrandit jamais au-delà de la résolution réellement disponible.
      const outW = Math.max(MIN_OUTPUT_WIDTH, Math.min(outputWidth, Math.round(sw)));
      const outH = Math.max(1, Math.round(outW / aspect));

      const canvas = document.createElement("canvas");
      canvas.width = outW;
      canvas.height = outH;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Recadrage impossible sur ce navigateur.");
      ctx.fillStyle = CANVAS_BACKGROUND;
      ctx.fillRect(0, 0, outW, outH);
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, outW, outH);

      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/jpeg", 0.9),
      );
      if (!blob) throw new Error("Recadrage impossible.");

      onDone(new File([blob], round ? "avatar.jpg" : "banner.jpg", { type: "image/jpeg" }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Recadrage impossible.");
      setBusy(false);
    }
  };

  return (
    <div className={styles.overlay} onClick={(e) => e.target === e.currentTarget && onCancel()}>
      <div className={styles.modal}>
        <button className={styles.closeBtn} onClick={onCancel} aria-label="Annuler">
          <X size={15} />
        </button>
        <div className={styles.title}>{title}</div>
        <div className={styles.hint}>Glissez l&apos;image pour la positionner, zoomez pour recadrer.</div>

        <div
          ref={frameRef}
          className={`${styles.frame} ${round ? styles.frameRound : ""}`}
          style={{ aspectRatio: String(aspect) }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onWheel={onWheel}
        >
          {url ? (
            // next/image n'apporte rien sur une blob: URL locale et impose
            // des contraintes de layout incompatibles avec le glissé.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={url}
              alt=""
              className={styles.image}
              draggable={false}
              style={{
                width: drawnW || undefined,
                height: drawnH || undefined,
                transform: `translate(${offset.x}px, ${offset.y}px)`,
              }}
            />
          ) : (
            !error && <div className={styles.loading}>Chargement de l&apos;image…</div>
          )}
          <div className={styles.grid} />
        </div>

        <div className={styles.controls}>
          <ZoomOut size={15} className={styles.zoomIcon} />
          <input
            type="range"
            className={styles.slider}
            min={MIN_ZOOM}
            max={MAX_ZOOM}
            step={0.01}
            value={zoom}
            onChange={(e) => applyZoom(Number(e.target.value))}
            aria-label="Zoom"
          />
          <ZoomIn size={15} className={styles.zoomIcon} />
          <button className={styles.resetBtn} onClick={reset} title="Réinitialiser">
            <RotateCcw size={14} />
          </button>
        </div>

        {error && <div className={styles.error}>{error}</div>}

        <div className={styles.actions}>
          <button className={styles.btnGhost} onClick={onCancel}>Annuler</button>
          <button className={styles.btnPrimary} onClick={handleValidate} disabled={!img || busy}>
            <Check size={14} /> {busy ? "Recadrage…" : "Valider le recadrage"}
          </button>
        </div>
      </div>
    </div>
  );
}
