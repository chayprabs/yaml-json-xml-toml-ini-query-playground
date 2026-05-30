import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Credits — Pluck",
};

export default function CreditsPage() {
  return (
    <main className="mx-auto min-h-screen w-full max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
      <article className="rounded-[2rem] border border-ink/10 bg-white/80 p-8 shadow-panel backdrop-blur">
        <h1 className="text-3xl font-semibold tracking-tight text-ink">
          Credits
        </h1>
        <ul className="mt-8 list-disc space-y-4 pl-5 text-sm leading-7 text-ink/80">
          <li>
            Expression engine:{" "}
            <a
              className="font-semibold text-ember underline underline-offset-2"
              href="https://github.com/mikefarah/yq"
              rel="noreferrer"
              target="_blank"
            >
              yq
            </a>{" "}
            by Mike Farah (MIT)
          </li>
          <li>
            Selector engine:{" "}
            <a
              className="font-semibold text-ember underline underline-offset-2"
              href="https://github.com/TomWright/dasel"
              rel="noreferrer"
              target="_blank"
            >
              dasel
            </a>{" "}
            by Tom Wright (MIT)
          </li>
          <li>
            Runtime:{" "}
            <a
              className="font-semibold text-ember underline underline-offset-2"
              href="https://webassembly.org"
              rel="noreferrer"
              target="_blank"
            >
              Go WebAssembly
            </a>
          </li>
        </ul>
        <p className="mt-8 text-sm">
          <Link
            className="text-ember underline underline-offset-2"
            href="/third-party-licenses"
          >
            Full third-party license texts
          </Link>
        </p>
        <p className="mt-4 text-sm">
          <Link className="text-ember underline underline-offset-2" href="/">
            ← Back to Pluck
          </Link>
        </p>
      </article>
    </main>
  );
}
