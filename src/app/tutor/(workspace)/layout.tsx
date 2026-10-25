import { House } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { BrandMark } from "@/components/brand";
import { ModeBadge, ModeBanner } from "@/components/mode-badge";
import { SiteFooter } from "@/components/site-footer";
import { TutorNav } from "@/components/tutor/chrome";

export default function TutorWorkspaceLayout({ children }: LayoutProps<"/tutor">) {
  return (
    <>
      <header className="sticky top-0 z-20 border-b border-line/70 bg-paper/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-5">
          <Link href="/tutor" className="flex items-center gap-2.5 rounded-lg">
            <BrandMark tone="accent" />
            <span className="hidden leading-tight sm:block">
              <span className="block font-display text-[1.05rem] font-semibold tracking-tight">Textbook AI Tutor</span>
              <span className="block text-xs text-ink-3">Teacher workspace</span>
            </span>
          </Link>
          <div className="ml-2 sm:ml-6">
            <TutorNav />
          </div>
          <div className="ml-auto flex items-center gap-2">
            <ModeBadge />
            <Link
              href="/"
              className="grid size-9 place-items-center rounded-lg text-ink-2 hover:bg-paper-2 hover:text-ink"
              aria-label="Platform home"
              title="Platform home"
            >
              <House weight="duotone" className="size-5" />
            </Link>
          </div>
        </div>
      </header>
      <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-5 pt-8 pb-24">
        <ModeBanner />
        <div className="mt-6">{children}</div>
      </main>
      <SiteFooter />
    </>
  );
}
