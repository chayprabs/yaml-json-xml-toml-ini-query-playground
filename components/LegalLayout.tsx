import Link from "next/link";
import type { ReactNode } from "react";

import { SiteHeader } from "@/components/SiteHeader";

export function LegalLayout({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-[#fafafa]">
      <SiteHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10 sm:px-6 lg:px-8">
        <article className="rounded-xl border border-neutral-200 bg-white p-8 shadow-sm">
          <h1 className="text-3xl font-semibold tracking-tight text-neutral-900">
            {title}
          </h1>
          <div className="mt-8 space-y-6 text-sm leading-7 text-neutral-700">
            {children}
          </div>
          <p className="mt-8 text-sm">
            <Link
              className="font-medium text-blue-600 underline underline-offset-2"
              href="/"
            >
              ← Back to Pluck
            </Link>
          </p>
        </article>
      </main>
    </div>
  );
}
