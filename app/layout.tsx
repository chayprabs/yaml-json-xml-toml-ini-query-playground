import type { Metadata } from "next";
import Script from "next/script";
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
  title: "yq WASM Playground",
  description: "Run mikefarah/yq entirely in your browser through WebAssembly.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${display.variable} ${mono.variable}`}>
      <body className="font-[family-name:var(--font-display)] antialiased">
        <Script src="./wasm_exec.js" strategy="beforeInteractive" />
        {children}
      </body>
    </html>
  );
}
