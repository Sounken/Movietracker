import type { Metadata, Viewport } from "next";
import { Geist_Mono } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";

/**
 * Blauer Nue (Webhance Studio) remplace Geist pour le texte courant, Cooper
 * Black remplace Instrument Serif pour les titres.
 *
 * Auto-hébergées via `next/font/local` : les fichiers partent de notre domaine,
 * Next écrit le `@font-face` et les précharge — aucune requête tierce, à la
 * différence d'un chargement depuis Adobe Fonts, qui interdit l'auto-hébergement.
 *
 * Les deux polices ignorent ★ et →, que l'interface affiche comme du texte
 * (badges de note, boutons d'import). La chaîne de repli est donc explicite :
 * ces deux symboles retombent sur la police système, ce qui passe inaperçu pour
 * des pictogrammes — bien moins que si c'étaient des lettres.
 */
const blauerNue = localFont({
  src: "./fonts/blauer-nue-regular.woff2",
  variable: "--font-sans",
  display: "swap",
  weight: "400",
  fallback: ["system-ui", "-apple-system", "Segoe UI", "sans-serif"],
});

/**
 * `size-adjust` : mesuré à 100px sur « Il était une fois dans l'Ouest »,
 * Cooper Black occupe 1402px contre 926px pour Instrument Serif — elle est
 * **1,52× plus large**. Les tailles en dur du site ont été réglées sur une
 * serif fine et élancée ; reprises telles quelles, les titres débordent (celui
 * du carrousel passait à deux lignes).
 *
 * Ramener la largeur à l'identique demanderait 66%, ce qui écraserait la
 * police et gâcherait ce qu'on est venu y chercher. 85% est le compromis :
 * l'encombrement retombe à ~1,3× au lieu de 1,52×, la présence reste. C'est le
 * seul curseur à bouger si les titres paraissent encore trop gros — il agit
 * d'un coup sur la cinquantaine de déclarations `--font-serif` du site, là où
 * les reprendre une par une serait ingérable.
 */
const cooperBlack = localFont({
  src: "./fonts/cooper-black.woff2",
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
      className={`${blauerNue.variable} ${geistMono.variable} ${cooperBlack.variable}`}
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
