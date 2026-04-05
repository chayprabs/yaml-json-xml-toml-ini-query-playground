import Link from "next/link";

import { PlaygroundBoundary } from "@/components/PlaygroundBoundary";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-10 px-4 py-8 sm:px-6 lg:px-8">
      <section className="rounded-[2rem] border border-ink/10 bg-white/70 p-8 shadow-panel backdrop-blur md:p-10">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl space-y-4">
            <p className="text-sm font-semibold uppercase tracking-[0.35em] text-ember">
              Prabuddha Engine by Chaitanya Prabuddha
            </p>
            <h1 className="text-4xl font-semibold tracking-tight text-ink sm:text-5xl">
              Structured data queries and conversion, fully in the browser.
            </h1>
            <p className="max-w-2xl text-base leading-7 text-ink/75 sm:text-lg">
              Prabuddha Engine runs expressions, format conversion, and
              multi-document handling client-side with WebAssembly. No API
              routes. No server-side evaluation. Just static files.
            </p>
          </div>
          <div className="grid gap-3 rounded-2xl border border-ink/10 bg-paper/80 p-5 text-sm text-ink/75 sm:grid-cols-3 sm:gap-5">
            <div>
              <p className="font-semibold text-ink">Inputs</p>
              <p>YAML, JSON, XML, CSV, TOML</p>
            </div>
            <div>
              <p className="font-semibold text-ink">Outputs</p>
              <p>YAML, JSON, XML, CSV, TOML, props</p>
            </div>
            <div>
              <p className="font-semibold text-ink">Deployment</p>
              <p>Static export ready for Pages hosting</p>
            </div>
          </div>
        </div>
        <div className="mt-8 grid gap-3 rounded-2xl border border-ink/10 bg-[#17141f] p-5 text-sm text-paper/75 sm:grid-cols-4">
          <div>
            <p className="font-semibold text-paper">Shareable</p>
            <p>
              Input, expression, formats, and toggles sync into the URL hash.
            </p>
          </div>
          <div>
            <p className="font-semibold text-paper">Fast Feedback</p>
            <p>
              Auto-run is debounced, and manual runs work with Cmd/Ctrl+Enter.
            </p>
          </div>
          <div>
            <p className="font-semibold text-paper">Output Controls</p>
            <p>Copy results, toggle unwrap scalar, no-doc, and pretty print.</p>
          </div>
          <div>
            <p className="font-semibold text-paper">100% Browser</p>
            <p>
              All processing stays in WebAssembly with zero backend services.
            </p>
          </div>
        </div>
      </section>

      <PlaygroundBoundary />

      <footer className="pb-4 text-center">
        <Link
          href="/credits"
          className="text-xs text-ink/55 transition hover:text-ember"
        >
          Open source credits
        </Link>
      </footer>
    </main>
  );
}
