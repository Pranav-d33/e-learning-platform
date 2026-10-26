import type { Metadata } from "next";
import { PracticePaper } from "@/components/tutor/practice-paper";

export const metadata: Metadata = { title: "Practice Paper · Textbook AI Tutor" };

export default async function PracticePaperPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <PracticePaper id={id} />;
}
