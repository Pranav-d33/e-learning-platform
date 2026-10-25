import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { LetterGrid } from "@/components/early/letter-grid";
import { LANGUAGES, isLanguage, lessonSummaries } from "@/lib/early/lessons";

export function generateStaticParams() {
  return [{ language: "en" }, { language: "hi" }];
}

export async function generateMetadata({ params }: PageProps<"/early/[language]">): Promise<Metadata> {
  const { language } = await params;
  return { title: isLanguage(language) ? `${LANGUAGES[language].label} letters` : "Letters" };
}

function Grid({ language }: { language: string }) {
  if (!isLanguage(language)) notFound();
  const tiles = lessonSummaries(language).map(({ slug, character, group }) => ({ slug, character, group }));
  return <LetterGrid language={language} tiles={tiles} />;
}

// Every language is prerendered via generateStaticParams; Suspense keeps navigations instant.
export default function LanguagePage({ params }: PageProps<"/early/[language]">) {
  return <Suspense fallback={null}>{params.then(({ language }) => <Grid language={language} />)}</Suspense>;
}
