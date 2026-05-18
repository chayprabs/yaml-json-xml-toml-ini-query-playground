import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy — Pluck",
};

export default function PrivacyPage() {
  return (
    <main className="mx-auto min-h-screen w-full max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
      <article className="rounded-[2rem] border border-ink/10 bg-white/80 p-8 shadow-panel backdrop-blur">
        <h1 className="text-3xl font-semibold tracking-tight text-ink">
          Privacy
        </h1>
        <div className="mt-8 space-y-6 text-sm leading-7 text-ink/80">
          <section>
            <h2 className="text-lg font-semibold text-ink">Data we collect</h2>
            <p className="mt-2">
              None. Pluck does not collect, store, or transmit any personal data,
              usage data, or document content.
            </p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-ink">Cookies</h2>
            <p className="mt-2">
              Pluck does not set any cookies. Your hosting infrastructure
              (Cloudflare) may set a short-lived cookie for security purposes as
              part of its standard network operation. This cookie is set by
              Cloudflare, not by Pluck, and contains no user content.
            </p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-ink">Analytics</h2>
            <p className="mt-2">
              None. Pluck does not include any analytics, tracking, or telemetry.
            </p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-ink">Third-party services</h2>
            <p className="mt-2">
              Pluck is served as a static site. The only third-party involved in
              delivery is Cloudflare (CDN and hosting). No user content is shared
              with Cloudflare — only standard HTTP request metadata (IP address,
              User-Agent, URL path) is visible to Cloudflare as part of normal HTTP
              traffic routing.
            </p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-ink">
              How your documents are processed
            </h2>
            <p className="mt-2">
              Documents you paste into Pluck are processed entirely within your
              browser using WebAssembly. They are never uploaded to any server.
            </p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-ink">Contact</h2>
            <p className="mt-2">
              For questions about this privacy notice, contact the maintainer via
              the{" "}
              <a
                className="font-semibold text-ember underline underline-offset-2"
                href="https://github.com/chayprabs"
                rel="noreferrer"
                target="_blank"
              >
                GitHub profile
              </a>
              , open an issue on the{" "}
              <a
                className="font-semibold text-ember underline underline-offset-2"
                href="https://github.com/chayprabs/yaml-json-xml-toml-ini-query-playground/issues"
                rel="noreferrer"
                target="_blank"
              >
                project repository
              </a>
              , or email{" "}
              <a
                className="font-semibold text-ember underline underline-offset-2"
                href="mailto:support@authos.app"
              >
                support@authos.app
              </a>
              .
            </p>
          </section>
          <p className="text-xs text-ink/55">Last updated: May 18, 2026</p>
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
