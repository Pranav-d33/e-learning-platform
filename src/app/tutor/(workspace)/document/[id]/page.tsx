import type { Metadata } from "next";
import { Suspense } from "react";
import { DocumentView } from "@/components/tutor/document-view";
import { Skeleton } from "@/components/ui/spinner";

export const metadata: Metadata = { title: "Source preview" };

export default function DocumentPage({ params }: PageProps<"/tutor/document/[id]">) {
  return (
    <Suspense fallback={<Skeleton className="h-64" />}>
      {params.then(({ id }) => (
        <DocumentView id={id} />
      ))}
    </Suspense>
  );
}
