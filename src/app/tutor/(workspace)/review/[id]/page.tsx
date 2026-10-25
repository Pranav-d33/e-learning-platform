import type { Metadata } from "next";
import { Suspense } from "react";
import { QuizReview } from "@/components/tutor/review";
import { Skeleton } from "@/components/ui/spinner";

export const metadata: Metadata = { title: "Review questions" };

export default function ReviewPage({ params }: PageProps<"/tutor/review/[id]">) {
  return (
    <Suspense fallback={<Skeleton className="h-96" />}>
      {params.then(({ id }) => (
        <QuizReview id={id} />
      ))}
    </Suspense>
  );
}
