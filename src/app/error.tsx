"use client";

import { useEffect } from "react";
import { Button, LinkButton } from "@/components/ui/button";

/** Route-level error boundary: friendly message, retry, never a stack trace. */
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <main id="main" className="grid flex-1 place-items-center px-5 py-24 text-center">
      <div className="max-w-md">
        <h1 className="font-display text-3xl font-semibold tracking-tight">Something went wrong on this page</h1>
        <p className="mt-3 text-ink-2">Try again — if it keeps happening, go back home and reopen the module.</p>
        {error.digest && <p className="mt-2 font-mono text-xs text-ink-3">Reference: {error.digest}</p>}
        <div className="mt-8 flex justify-center gap-3">
          <Button onClick={reset}>Try again</Button>
          <LinkButton href="/" variant="secondary">
            Home
          </LinkButton>
        </div>
      </div>
    </main>
  );
}
