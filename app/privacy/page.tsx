import type { Metadata } from "next";

import { LegalLayout } from "@/components/LegalLayout";

export const metadata: Metadata = {
  title: "Privacy — Pluck",
};

export default function PrivacyPage() {
  return (
    <LegalLayout title="Privacy policy">
      <section>
        <h2 className="text-lg font-semibold text-neutral-900">
          Data we collect
        </h2>
        <p className="mt-2">
          None. Pluck does not collect, store, or transmit any personal data,
          usage data, or document content.
        </p>
      </section>
      <section>
        <h2 className="text-lg font-semibold text-neutral-900">Cookies</h2>
        <p className="mt-2">
          Pluck does not set application cookies. Your hosting provider (for
          example Cloudflare) may set short-lived security cookies as part of
          normal HTTP delivery. Those cookies are not set by Pluck and do not
          contain your pasted documents.
        </p>
      </section>
      <section>
        <h2 className="text-lg font-semibold text-neutral-900">Analytics</h2>
        <p className="mt-2">
          None. Pluck does not include analytics, tracking, or telemetry that
          receives document content.
        </p>
      </section>
      <section>
        <h2 className="text-lg font-semibold text-neutral-900">
          How your documents are processed
        </h2>
        <p className="mt-2">
          Documents you paste are processed entirely in your browser using
          WebAssembly inside web workers. They are never uploaded to an
          application server operated by Pluck.
        </p>
      </section>
      <section>
        <h2 className="text-lg font-semibold text-neutral-900">URL sharing</h2>
        <p className="mt-2">
          When you copy a share link, workspace state is encoded in the URL hash
          fragment on your device. The fragment is not sent to the server as
          part of a normal HTTP request body. Anyone with the full link can
          decode the workspace in their own browser.
        </p>
      </section>
      <section>
        <h2 className="text-lg font-semibold text-neutral-900">Disclaimer</h2>
        <p className="mt-2">
          This notice describes how Pluck is designed to operate. It is not
          legal advice. Use the tool at your own risk and do not rely on it for
          compliance decisions without independent review.
        </p>
      </section>
      <section>
        <h2 className="text-lg font-semibold text-neutral-900">Contact</h2>
        <p className="mt-2">
          Questions about this notice: open an issue on the{" "}
          <a
            className="font-medium text-blue-600 underline underline-offset-2"
            href="https://github.com/chayprabs/yaml-json-xml-toml-ini-query-playground/issues"
            rel="noopener noreferrer"
            target="_blank"
          >
            GitHub repository
          </a>{" "}
          or contact{" "}
          <a
            className="font-medium text-blue-600 underline underline-offset-2"
            href="https://github.com/chayprabs"
            rel="noopener noreferrer"
            target="_blank"
          >
            @chayprabs
          </a>
          .
        </p>
      </section>
      <p className="text-xs text-neutral-400">Last updated: May 29, 2026</p>
    </LegalLayout>
  );
}
