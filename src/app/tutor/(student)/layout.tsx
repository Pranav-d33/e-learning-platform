import Link from "next/link";
import { BrandMark } from "@/components/brand";
import { SiteFooter } from "@/components/site-footer";

export default function StudentLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <header className="border-b border-line/70 bg-paper/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-4xl items-center gap-3 px-5">
          <BrandMark tone="accent" className="size-8" />
          <span className="font-display text-[1.05rem] font-semibold tracking-tight">Quiz time</span>
          <Link href="/tutor" className="ml-auto rounded-lg px-3 py-2 text-sm font-semibold text-ink-2 hover:bg-paper-2 hover:text-ink">
            Teacher view
          </Link>
        </div>
      </header>
      <main id="main" className="mx-auto w-full max-w-4xl flex-1 px-5 pt-8 pb-20">
        {children}
      </main>
      <SiteFooter />
    </>
  );
}
