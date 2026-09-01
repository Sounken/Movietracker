import type { Metadata, Viewport } from "next";
import { Geist_Mono } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";

/**
 * Blauer Nue (Webhance Studio) remplace Geist pour le texte courant, New Kansas
 * Black (Newlyn Works) remplace Instrument Serif pour les titres.
 *
 * Auto-hébergées via `next/font/local` : les fichiers partent de notre domaine,
 * Next écrit le `@font-face` et les précharge — aucune requête tierce, à la
 * différence d'un chargement depuis Adobe Fonts, qui interdit l'auto-hébergement.
 *
 * Aucune des deux ne contient ★, que l'interface affiche comme du texte (badges
 * de note, filtres). La chaîne de repli est donc explicite pour qu'il tombe sur
 * la police système, ce qui passe inaperçu pour un pictogramme — bien moins que
 * si c'était une lettre.
 */
const blauerNue = localFont({
  src: "./fonts/blauer-nue-regular.woff2",
  variable: "--font-sans",
  display: "swap",
  weight: "400",
  fallback: ["system-ui", "-apple-system", "Segoe UI", "sans-serif"],
});

/**
 * New Kansas Black (Newlyn Works) porte les titres.
 *
 * Elle remplace Cooper Black, dont les chiffres elzéviriens désalignaient les
 * colonnes de statistiques et avaient dû être redessinés à la main dans le
 * fichier. Ce bricolage disparaît : New Kansas a des chiffres déjà alignés et
 * embarque `lnum`/`tnum`, donc la chasse tabulaire s'obtient proprement en CSS
 * (`font-variant-numeric: tabular-nums`) là où des nombres s'empilent.
 *
 * `size-adjust` : mesuré à 100px sur « Il était une fois dans l'Ouest », elle
 * occupe 1459px contre 926px pour Instrument Serif, soit **1,58× plus large**.
 * Les tailles en dur du site ont été réglées sur une serif fine et élancée ;
 * reprises telles quelles, les titres débordent. Égaliser demanderait 63%, ce
 * qui écraserait la police ; 85% ramène l'encombrement à ~1,34× en gardant sa
 * présence. C'est le seul curseur à bouger si les titres paraissent encore trop
 * gros — il agit d'un coup sur la cinquantaine de déclarations `--font-serif`,
 * là où les reprendre une par une serait ingérable.
 */
const newKansas = localFont({
  src: "./fonts/new-kansas-black.woff2",
  variable: "--font-serif",
  display: "swap",
  weight: "400",
  fallback: ["Georgia", "serif"],
  declarations: [{ prop: "size-adjust", value: "85%" }],
});

/**
 * Geist Mono reste, et c'est un choix fonctionnel : c'est la police des
 * chiffres. Ceux de Blauer Nue sont à chasse proportionnelle — le « 1 » fait
 * 409 unités contre 666 pour le « 8 », 63% d'écart — et la police n'embarque
 * aucune variante tabulaire (`tnum`). Les notes qui changent au survol des
 * étoiles feraient donc danser la mise en page, précisément ce que la chasse
 * fixe évite aujourd'hui.
 */
const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "MovieTracker",
  description: "Votre journal de cinéma personnel",
  // Nom + comportement de l'app une fois ajoutée à l'écran d'accueil iOS
  appleWebApp: {
    capable: true,
    title: "MovieTracker",
    statusBarStyle: "black-translucent",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="fr"
      className={`${blauerNue.variable} ${geistMono.variable} ${newKansas.variable}`}
      style={{ fontFamily: "var(--font-sans), system-ui, sans-serif" }}
    >
      <head>
        {/* Sync theme before first paint to avoid flash */}
        {/* suppressHydrationWarning: browser extensions (e.g. Browsec) inject attributes on this tag */}
        <script suppressHydrationWarning dangerouslySetInnerHTML={{ __html: `(function(){try{if(localStorage.getItem('mt-theme')==='light')document.documentElement.setAttribute('data-theme','light')}catch(e){}})()` }} />
      </head>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
