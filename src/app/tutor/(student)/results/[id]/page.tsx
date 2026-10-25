import type { Metadata } from "next";
import { Suspense } from "react";
import { QuizResults } from "@/components/tutor/results";
import { Skeleton } from "@/components/ui/spinner";

export const metadata: Metadata = { title: "Quiz results" };

export default function ResultsPage({ params }: PageProps<"/tutor/results/[id]">) {
  return (
    <Suspense fallback={<Skeleton className="h-80 rounded-3xl" />}>
      {params.then(({ id }) => (
        <QuizResults id={id} />
      ))}
    </Suspense>
  );
}
