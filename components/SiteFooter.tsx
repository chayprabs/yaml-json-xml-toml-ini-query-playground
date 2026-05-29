import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="border-t border-neutral-200 bg-white">
      <div className="mx-auto max-w-7xl space-y-4 px-4 py-8 text-center sm:px-6 lg:px-8">
        <p
          className="text-sm leading-relaxed text-neutral-600"
          data-testid="privacy-notice"
        >
          <strong className="font-medium text-neutral-900">
            Your data never leaves your browser.
          </strong>{" "}
          Both engines run locally as WebAssembly. Nothing is sent to a server.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm">
          <Link
            className="font-medium text-neutral-700 underline decoration-neutral-300 underline-offset-4 transition hover:text-neutral-900"
            href="/privacy"
          >
            Privacy policy
          </Link>
          <Link
            className="font-medium text-neutral-700 underline decoration-neutral-300 underline-offset-4 transition hover:text-neutral-900"
            href="/terms"
          >
            Terms and conditions
          </Link>
        </div>
        <p className="text-xs text-neutral-400">
          © {new Date().getFullYear()} Chaitanya Prabuddha — MIT License
        </p>
      </div>
    </footer>
  );
}
