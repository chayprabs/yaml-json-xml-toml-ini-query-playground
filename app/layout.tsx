import type { Metadata } from "next";
import { IBM_Plex_Mono, Space_Grotesk } from "next/font/google";

import "./globals.css";

const display = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-display",
});

const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: "Prabuddha Engine",
  description:
    "A browser-native structured data playground by Chaitanya Prabuddha.",
  openGraph: {
    title: "Prabuddha Engine",
    description:
      "A browser-native structured data playground by Chaitanya Prabuddha.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${display.variable} ${mono.variable}`}>
      <body className="font-[family-name:var(--font-display)] antialiased">
        {children}
      </body>
    </html>
  );
}
