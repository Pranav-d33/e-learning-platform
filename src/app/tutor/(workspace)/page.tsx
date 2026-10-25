import type { Metadata } from "next";
import { TutorDashboard } from "@/components/tutor/dashboard";

export const metadata: Metadata = { title: "Textbook AI Tutor" };

export default function TutorPage() {
  return <TutorDashboard />;
}
