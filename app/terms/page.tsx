import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms of Service — Pluck",
};

export default function TermsPage() {
  return (
    <main className="mx-auto min-h-screen w-full max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
      <article className="rounded-[2rem] border border-ink/10 bg-white/80 p-8 shadow-panel backdrop-blur">
        <h1 className="text-3xl font-semibold tracking-tight text-ink">
          Terms of service
        </h1>
        <p className="mt-2 text-sm text-ink/65">
          Terms of use — same policy as below; “Terms of service” and “Terms
          of use” refer to this page.
        </p>
        <div className="mt-8 space-y-6 text-sm leading-7 text-ink/80">
          <section>
            <h2 className="text-lg font-semibold text-ink">Use at your own risk</h2>
            <p className="mt-2">
              Pluck is provided free of charge and as-is, without warranty of any
              kind. The tool is provided under the MIT License.
            </p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-ink">
              No warranty on output correctness
            </h2>
            <p className="mt-2">
              Expressions and selectors are evaluated by open-source engines (yq
              and dasel). Output correctness depends on those engines. The
              operator of Pluck makes no warranty that query results are accurate,
              complete, or suitable for any purpose.
            </p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-ink">Acceptable use</h2>
            <p className="mt-2">
              You may not use Pluck to process data in a manner that violates
              applicable laws. You are responsible for the content you paste into
              the tool.
            </p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-ink">Open source</h2>
            <p className="mt-2">
              Pluck&apos;s source code is available under the MIT License. The
              bundled engines (yq by Mike Farah, dasel by Tom Wright) are also MIT
              licensed. See{" "}
              <Link
                className="font-semibold text-ember underline underline-offset-2"
                href="/third-party-licenses"
              >
                third-party licenses
              </Link>
              .
            </p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-ink">Changes</h2>
            <p className="mt-2">
              These terms may be updated at any time. Continued use of the tool
              constitutes acceptance.
            </p>
          </section>
        </div>
        <p className="mt-8 text-sm">
          <Link className="text-ember underline underline-offset-2" href="/">
            ← Back to Pluck
          </Link>
        </p>
      </article>
    </main>
  );
}
