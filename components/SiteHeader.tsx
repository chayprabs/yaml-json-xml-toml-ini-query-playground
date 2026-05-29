import Link from "next/link";
import type { ReactNode } from "react";

const GITHUB_REPO =
  "https://github.com/chayprabs/yaml-json-xml-toml-ini-query-playground";

function IconLink({
  href,
  label,
  children,
}: {
  href: string;
  label: string;
  children: ReactNode;
}) {
  return (
    <a
      href={href}
      aria-label={label}
      className="flex h-9 w-9 items-center justify-center rounded-lg text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-900"
      rel="noopener noreferrer"
      target="_blank"
    >
      {children}
    </a>
  );
}

function GitHubIcon() {
  return (
    <svg aria-hidden className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-1.02-.54-1.02-.54 0-1.65 1.02-.315 1.23-1.395 1.23-2.13 0-1.59-.855-2.805-2.385-2.805-1.185 0-1.935.615-2.25 1.23-.435-.75-1.185-1.23-2.04-1.23-1.545 0-2.385 1.17-2.385 2.805 0 1.05.39 1.8 1.23 2.13-.99.99-.99 2.565 0 3.555.615.315 1.23.39 1.845.39.615 0 1.23-.075 1.845-.39.99-.99.99-2.565 0-3.555.84-.33 1.23-1.08 1.23-2.13 0-2.25-1.5-3.6-3.9-3.6-2.7 0-4.35 2.04-4.35 4.2 0 .825.315 1.71.735 2.19.075.09.075.165.045.255-.075.315-.24 1.005-.27 1.14-.045.18-.135.225-.315.135-1.245-.57-2.025-2.355-2.025-3.78 0-3.075 2.235-5.895 6.435-5.895 3.375 0 5.985 2.4 5.985 5.61 0 3.345-2.1 6.03-5.01 6.03-.975 0-1.89-.51-2.205-1.11l-.6 2.28c-.225.87-.84 1.965-1.26 2.625 0 .075-.075.135-.18.12C3.585 21.57 0 16.995 0 12 0 5.37 5.37 0 12 0Z" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg aria-hidden className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

function WebsiteIcon() {
  return (
    <svg
      aria-hidden
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      viewBox="0 0 24 24"
    >
      <path
        d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M3.6 9h16.8M3.6 15h16.8M12 3c2.2 2.5 3.4 5.8 3.4 9s-1.2 6.5-3.4 9M12 3c-2.2 2.5-3.4 5.8-3.4 9s1.2 6.5 3.4 9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-neutral-200/80 bg-white/95 backdrop-blur-sm">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <Link
          className="text-lg font-semibold tracking-tight text-neutral-900"
          href="/"
        >
          Pluck
        </Link>
        <nav
          aria-label="External links"
          className="flex items-center gap-1 sm:gap-2"
        >
          <IconLink href={GITHUB_REPO} label="View source on GitHub">
            <GitHubIcon />
          </IconLink>
          <IconLink href="https://x.com/chayprabs" label="Chaitanya on X">
            <XIcon />
          </IconLink>
          <IconLink
            href="https://www.chaitanyaprabuddha.com"
            label="Chaitanya Prabuddha website"
          >
            <WebsiteIcon />
          </IconLink>
        </nav>
      </div>
    </header>
  );
}
