import type { Metadata } from "next";
import { readFileSync } from "node:fs";
import { join } from "node:path";

export const metadata: Metadata = {
  title: "Open Source Credits",
};

const creditsText = readFileSync(
  join(process.cwd(), "THIRD_PARTY_LICENSES.txt"),
  "utf8",
);

export default function CreditsPage() {
  return (
    <main className="mx-auto min-h-screen w-full max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="rounded-[2rem] border border-ink/10 bg-white/80 p-6 shadow-panel backdrop-blur sm:p-8">
        <h1 className="text-3xl font-semibold tracking-tight text-ink">
          Open Source Credits
        </h1>
        <pre className="mt-6 overflow-x-auto whitespace-pre-wrap rounded-[1.5rem] border border-ink/10 bg-paper/70 p-5 font-[family-name:var(--font-mono)] text-sm leading-7 text-ink">
          {creditsText}
        </pre>
      </div>
    </main>
  );
}
