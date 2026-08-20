"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import styles from "./profile.module.css";

const ImportModal = dynamic(() => import("./ImportModal"), { ssr: false });

export default function ImportButton() {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  return (
    <>
      <button
        className={styles.btnImport}
        onClick={() => setOpen(true)}
        title="Importer depuis Letterboxd"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="7 10 12 15 17 10" />
          <line x1="12" y1="15" x2="12" y2="3" />
        </svg>
        {/* Libellé masqué sur mobile (comme « Modifier le profil ») pour que
            les deux boutons tiennent sur la même ligne. */}
        <span className={styles.btnImportLabel}>Importer depuis Letterboxd</span>
      </button>
      {open && (
        <ImportModal
          onClose={() => setOpen(false)}
          onDone={() => router.refresh()}
        />
      )}
    </>
  );
}
