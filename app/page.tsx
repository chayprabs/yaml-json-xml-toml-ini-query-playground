import Link from "next/link";

import { PlaygroundBoundary } from "@/components/PlaygroundBoundary";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-10 px-4 py-8 sm:px-6 lg:px-8">
      <section className="rounded-[2rem] border border-ink/10 bg-white/70 p-8 shadow-panel backdrop-blur md:p-10">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl space-y-4">
            <p className="text-sm font-semibold uppercase tracking-[0.35em] text-ember">
              Pluck by Chaitanya Prabuddha
            </p>
            <h1 className="text-4xl font-semibold tracking-tight text-ink sm:text-5xl">
              Query structured config, fully in the browser.
            </h1>
            <p className="max-w-2xl text-base leading-7 text-ink/75 sm:text-lg">
              Pluck loads two Go WebAssembly engines client-side so you can run
              expressions, selectors, and format conversions without any backend
              services. No API routes. No server-side evaluation. Just static
              files.
            </p>
          </div>
          <div className="grid gap-3 rounded-2xl border border-ink/10 bg-paper/80 p-5 text-sm text-ink/75 sm:grid-cols-3 sm:gap-5">
            <div>
              <p className="font-semibold text-ink">Engines</p>
              <p>
                Expression and selector modes; each WebAssembly worker loads the
                first time you run that engine.
              </p>
            </div>
            <div>
              <p className="font-semibold text-ink">Formats</p>
              <p>YAML, JSON, XML, CSV, TOML, INI, HCL, props</p>
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
            <p className="font-semibold text-paper">Native Dual Engine</p>
            <p>Both runtimes stay in WebAssembly with zero backend services.</p>
          </div>
        </div>
      </section>

      <PlaygroundBoundary />

      <footer className="space-y-3 pb-6 text-center text-sm text-ink/70">
        <p data-testid="privacy-notice">
          Your data never leaves your browser. Both engines run locally as
          WebAssembly. Nothing is sent to a server.
        </p>
        <div className="flex flex-wrap justify-center gap-x-4 gap-y-2 text-xs text-ink/55">
          <Link className="transition hover:text-ember" href="/privacy">
            Privacy
          </Link>
          <Link className="transition hover:text-ember" href="/terms">
            Terms
          </Link>
          <Link className="transition hover:text-ember" href="/credits">
            Credits
          </Link>
          <Link
            className="transition hover:text-ember"
            href="/third-party-licenses"
          >
            Third-party licenses
          </Link>
        </div>
        <p className="text-xs text-ink/50">
          © 2026 Chaitanya Prabuddha — MIT License
        </p>
      </footer>
    </main>
  );
}
