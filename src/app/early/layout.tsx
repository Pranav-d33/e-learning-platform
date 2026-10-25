import type { Metadata } from "next";
import { EarlyHeader } from "@/components/early/header";
import { SiteFooter } from "@/components/site-footer";

export const metadata: Metadata = { title: { default: "Early Learning Studio", template: "%s · Early Learning Studio" } };

export default function EarlyLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="kid dotted-paper flex min-h-dvh flex-col bg-[oklch(0.972_0.022_86)]">
      <EarlyHeader />
      <main id="main" className="mx-auto w-full max-w-5xl flex-1 px-4 pt-6 pb-16 sm:pt-8">
        {children}
      </main>
      <SiteFooter variant="kid" />
    </div>
  );
}
