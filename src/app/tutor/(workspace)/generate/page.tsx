import type { Metadata } from "next";
import { Suspense } from "react";
import { QuizSetup } from "@/components/tutor/quiz-setup";
import { Skeleton } from "@/components/ui/spinner";

export const metadata: Metadata = { title: "Build a quiz" };

export default function GeneratePage() {
  return (
    <Suspense fallback={<Skeleton className="h-96" />}>
      <QuizSetup />
    </Suspense>
  );
}
