import { BrandMark } from "@/components/brand";
import { LinkButton } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main id="main" className="grid flex-1 place-items-center px-5 py-24 text-center">
      <div className="max-w-md">
        <BrandMark className="mx-auto size-12" />
        <p className="mt-6 font-mono text-sm font-semibold text-ink-3">404</p>
        <h1 className="mt-1 font-display text-4xl font-semibold tracking-tight">This page isn&apos;t in the book</h1>
        <p className="mt-3 text-ink-2">
          The link may be old, or a temporary quiz or upload was cleared. Pick a module to keep going.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <LinkButton href="/tutor">Textbook Tutor</LinkButton>
          <LinkButton href="/early" variant="secondary">
            Early Learning
          </LinkButton>
          <LinkButton href="/" variant="ghost">
            Home
          </LinkButton>
        </div>
      </div>
    </main>
  );
}
