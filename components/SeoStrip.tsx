export function SeoStrip() {
  return (
    <section
      aria-label="About Pluck"
      className="border-b border-neutral-200 bg-neutral-50"
    >
      <div className="mx-auto max-w-7xl px-4 py-3 sm:px-6 lg:px-8">
        <p className="text-sm leading-snug text-neutral-700">
          <strong className="font-medium text-neutral-900">Pluck</strong> is a
          free browser playground for YAML, JSON, XML, CSV, TOML, INI, and HCL —
          run yq-style expressions or dasel selectors with zero install and no
          server upload.
        </p>
        <p className="mt-1 text-sm leading-snug text-neutral-600">
          Paste your config below, pick an engine and output format, then hit
          Run — everything stays in WebAssembly on your device.
        </p>
      </div>
    </section>
  );
}
