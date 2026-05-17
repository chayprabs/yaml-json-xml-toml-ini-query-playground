import type { Metadata } from "next";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import Link from "next/link";

export const metadata: Metadata = {
  title: "Third-party licenses — Pluck",
};

const licensesText = readFileSync(
  join(process.cwd(), "THIRD_PARTY_LICENSES.txt"),
  "utf8",
);

export default function ThirdPartyLicensesPage() {
  return (
    <main className="mx-auto min-h-screen w-full max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="rounded-[2rem] border border-ink/10 bg-white/80 p-6 shadow-panel backdrop-blur sm:p-8">
        <h1 className="text-3xl font-semibold tracking-tight text-ink">
          Third-party licenses
        </h1>
        <pre className="mt-6 overflow-x-auto whitespace-pre-wrap rounded-[1.5rem] border border-ink/10 bg-paper/70 p-5 font-[family-name:var(--font-mono)] text-sm leading-7 text-ink">
          {licensesText}
        </pre>
        <p className="mt-6 text-sm">
          <Link className="text-ember underline underline-offset-2" href="/">
            ← Back to Pluck
          </Link>
        </p>
      </div>
    </main>
  );
}
