import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://under-the-lights.flobl.workers.dev"),
  title: "Under the Lights | Soccerverse Prediction Game",
  description:
    "One Soccerverse match takes centre stage every week. Predict it, score points, and unlock achievements all season.",
  openGraph: {
    title: "Under the Lights",
    description: "One world. One match. Every week.",
    type: "website",
    images: [{ url: "/og.png", width: 1736, height: 905, alt: "Under the Lights Soccerverse prediction game" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Under the Lights",
    description: "One world. One match. Every week.",
    images: ["/og.png"],
  },
  icons: {
    icon: "/logo.png",
    shortcut: "/logo.png",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        {children}
      </body>
    </html>
  );
}
