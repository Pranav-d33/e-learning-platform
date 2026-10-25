import type { Metadata } from "next";
import { Suspense } from "react";
import { QuizRunner } from "@/components/tutor/quiz-runner";
import { Skeleton } from "@/components/ui/spinner";

export const metadata: Metadata = { title: "Quiz" };

export default function QuizPage({ params }: PageProps<"/tutor/quiz/[id]">) {
  return (
    <Suspense fallback={<Skeleton className="h-80 rounded-3xl" />}>
      {params.then(({ id }) => (
        <QuizRunner id={id} />
      ))}
    </Suspense>
  );
}
