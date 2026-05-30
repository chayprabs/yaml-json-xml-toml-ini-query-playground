import type { Metadata } from "next";
import Link from "next/link";

import { LegalLayout } from "@/components/LegalLayout";

export const metadata: Metadata = {
  title: "Terms — Pluck",
};

export default function TermsPage() {
  return (
    <LegalLayout title="Terms and conditions">
      <section>
        <h2 className="text-lg font-semibold text-neutral-900">Agreement</h2>
        <p className="mt-2">
          By using Pluck you agree to these terms. If you do not agree, do not
          use the tool.
        </p>
      </section>
      <section>
        <h2 className="text-lg font-semibold text-neutral-900">
          Provided as-is
        </h2>
        <p className="mt-2">
          Pluck is provided free of charge and &quot;as is&quot;, without
          warranties of any kind, express or implied, including merchantability,
          fitness for a particular purpose, and non-infringement. The software
          is licensed under the MIT License where applicable.
        </p>
      </section>
      <section>
        <h2 className="text-lg font-semibold text-neutral-900">
          No warranty on output
        </h2>
        <p className="mt-2">
          Results come from third-party open-source engines (yq and dasel). The
          operator makes no warranty that outputs are accurate, complete, or
          suitable for production, legal, security, or compliance use. You are
          solely responsible for verifying results before acting on them.
        </p>
      </section>
      <section>
        <h2 className="text-lg font-semibold text-neutral-900">
          Limitation of liability
        </h2>
        <p className="mt-2">
          To the fullest extent permitted by law, the authors and contributors
          shall not be liable for any indirect, incidental, special,
          consequential, or punitive damages, or any loss of profits, data,
          goodwill, or business interruption, arising from your use of Pluck —
          even if advised of the possibility of such damages. Where liability
          cannot be excluded, it is limited to the amount you paid to use Pluck
          (zero for the public web version).
        </p>
      </section>
      <section>
        <h2 className="text-lg font-semibold text-neutral-900">
          Your responsibilities
        </h2>
        <p className="mt-2">
          You are responsible for the content you paste, for complying with
          applicable laws, and for not using Pluck to process data you are not
          allowed to handle. Do not use the tool to violate third-party rights.
        </p>
      </section>
      <section>
        <h2 className="text-lg font-semibold text-neutral-900">
          Open source components
        </h2>
        <p className="mt-2">
          Pluck bundles yq (Mike Farah) and dasel (Tom Wright) under their
          respective licenses. See{" "}
          <Link
            className="font-medium text-blue-600 underline underline-offset-2"
            href="/third-party-licenses"
          >
            third-party licenses
          </Link>
          .
        </p>
      </section>
      <section>
        <h2 className="text-lg font-semibold text-neutral-900">Changes</h2>
        <p className="mt-2">
          These terms may be updated at any time. Continued use after changes
          constitutes acceptance of the revised terms.
        </p>
      </section>
      <p className="text-xs text-neutral-400">Last updated: May 29, 2026</p>
    </LegalLayout>
  );
}
