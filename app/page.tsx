import { PlaygroundBoundary } from "@/components/PlaygroundBoundary";
import { SeoStrip } from "@/components/SeoStrip";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col bg-[#fafafa]">
      <SiteHeader />
      <SeoStrip />
      <div className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:px-8">
        <PlaygroundBoundary />
      </div>
      <SiteFooter />
    </div>
  );
}
