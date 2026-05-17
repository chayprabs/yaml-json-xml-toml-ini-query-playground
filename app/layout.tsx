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
  title: "Pluck",
  description:
    "A browser-native config query playground. Paste YAML, JSON, XML, CSV, TOML, or INI and run expressions or selectors, fully client-side with WebAssembly.",
  openGraph: {
    title: "Pluck",
    description:
      "A browser-native config query playground. Paste YAML, JSON, XML, CSV, TOML, or INI and run expressions or selectors, fully client-side with WebAssembly.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${display.variable} ${mono.variable}`}>
      <head>
        <meta
          httpEquiv="Content-Security-Policy"
          content="default-src 'self'; script-src 'self' 'unsafe-eval'; script-src-elem 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; connect-src 'self' blob:; worker-src 'self' blob:; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'none'"
        />
      </head>
      <body className="font-[family-name:var(--font-display)] antialiased">
        {children}
      </body>
    </html>
  );
}
