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
  title: "Thank You | Under the Lights",
  description:
    "The Under the Lights beta has ended. Thank you to everyone who joined us.",
  openGraph: {
    title: "Thank You | Under the Lights",
    description: "The Under the Lights beta has ended. Thank you to everyone who joined us.",
    type: "website",
    images: [{ url: "/beta-farewell.png", width: 1716, height: 916, alt: "An empty football stadium after the Under the Lights beta" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Thank You | Under the Lights",
    description: "The Under the Lights beta has ended. Thank you to everyone who joined us.",
    images: ["/beta-farewell.png"],
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
