import { YqPlayground } from "@/components/YqPlayground";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-10 px-4 py-8 sm:px-6 lg:px-8">
      <section className="rounded-[2rem] border border-ink/10 bg-white/70 p-8 shadow-panel backdrop-blur md:p-10">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl space-y-4">
            <p className="text-sm font-semibold uppercase tracking-[0.35em] text-ember">
              Fully Static Next.js + Go WASM
            </p>
            <h1 className="text-4xl font-semibold tracking-tight text-ink sm:text-5xl">
              A browser-only interface for{" "}
              <span className="text-ember">yq</span>.
            </h1>
            <p className="max-w-2xl text-base leading-7 text-ink/75 sm:text-lg">
              Expressions, format conversion, and multi-document handling all
              run client-side with WebAssembly. No API routes. No server-side
              evaluation. Just static files.
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
      </section>

      <YqPlayground />
    </main>
  );
}
