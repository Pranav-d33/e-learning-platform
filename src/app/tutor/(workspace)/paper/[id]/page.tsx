import type { Metadata } from "next";
import { Suspense } from "react";
import { PracticePaper } from "@/components/tutor/practice-paper";
import { Skeleton } from "@/components/ui/spinner";

export const metadata: Metadata = { title: "Practice Paper · Textbook AI Tutor" };

export default function PracticePaperPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<Skeleton className="h-96" />}>
      {params.then(({ id }) => (
        <PracticePaper id={id} />
      ))}
    </Suspense>
  );
}
