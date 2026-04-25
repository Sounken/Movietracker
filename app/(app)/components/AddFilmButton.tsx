"use client";

import { useState } from "react";
import AddFilmModal from "./AddFilmModal";
import styles from "./AddFilmButton.module.css";

export default function AddFilmButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className={styles.btn} onClick={() => setOpen(true)}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" width="13" height="13">
          <path d="M12 5v14M5 12h14" />
        </svg>
        Ajouter un film
      </button>
      {open && <AddFilmModal onClose={() => setOpen(false)} />}
    </>
  );
}
