import type { Metadata } from "next";
import { Suspense } from "react";
import { StudyStudio } from "@/components/tutor/study-studio";
import { Skeleton } from "@/components/ui/spinner";

export const metadata: Metadata = { title: "Study Studio · Textbook AI Tutor" };

export default function StudyStudioPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<Skeleton className="h-96" />}>
      {params.then(({ id }) => (
        <StudyStudio id={id} />
      ))}
    </Suspense>
  );
}
