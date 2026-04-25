import type { Metadata } from "next";
import { Geist, Geist_Mono, Instrument_Serif } from "next/font/google";
import "./globals.css";

const geist = Geist({
  variable: "--font-geist",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const instrumentSerif = Instrument_Serif({
  variable: "--font-serif",
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  title: "MovieTracker",
  description: "Votre journal de cinéma personnel",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="fr"
      className={`${geist.variable} ${geistMono.variable} ${instrumentSerif.variable}`}
      style={{ fontFamily: "var(--font-geist), system-ui, sans-serif" }}
    >
      <head>
        {/* Sync theme before first paint to avoid flash */}
        <script dangerouslySetInnerHTML={{ __html: `(function(){try{if(localStorage.getItem('mt-theme')==='light')document.documentElement.setAttribute('data-theme','light')}catch(e){}})()` }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
