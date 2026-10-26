import type { Metadata } from "next";
import { StudyStudio } from "@/components/tutor/study-studio";

export const metadata: Metadata = { title: "Study Studio · Textbook AI Tutor" };

export default async function StudyStudioPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <StudyStudio id={id} />;
}
