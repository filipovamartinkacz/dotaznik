import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

const livvic = localFont({
  src: [
    { path: "../../fonts/Livvic/Livvic-Regular.ttf", weight: "400", style: "normal" },
    { path: "../../fonts/Livvic/Livvic-Medium.ttf", weight: "500", style: "normal" },
    { path: "../../fonts/Livvic/Livvic-SemiBold.ttf", weight: "600", style: "normal" },
    { path: "../../fonts/Livvic/Livvic-Bold.ttf", weight: "700", style: "normal" },
  ],
  variable: "--font-livvic",
});

const thasadith = localFont({
  src: [
    { path: "../../fonts/Thasadith/Thasadith-Regular.ttf", weight: "400", style: "normal" },
    { path: "../../fonts/Thasadith/Thasadith-Bold.ttf", weight: "700", style: "normal" },
  ],
  variable: "--font-thasadith",
});

export const metadata: Metadata = {
  title: "JsemBlažená.cz - průzkum",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="cs" className={`${livvic.variable} ${thasadith.variable}`}>
      <body>{children}</body>
    </html>
  );
}
