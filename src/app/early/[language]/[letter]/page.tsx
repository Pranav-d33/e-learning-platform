import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { LessonView } from "@/components/early/lesson-view";
import { LANGUAGES, allLessonParams, getLesson, isLanguage, neighbours } from "@/lib/early/lessons";

export function generateStaticParams() {
  return allLessonParams();
}

export async function generateMetadata({ params }: PageProps<"/early/[language]/[letter]">): Promise<Metadata> {
  const { language, letter } = await params;
  const lesson = isLanguage(language) ? getLesson(language, letter) : undefined;
  return { title: lesson ? lesson.displayName : "Letter" };
}

function Content({ language, letter }: { language: string; letter: string }) {
  if (!isLanguage(language)) notFound();
  const lesson = getLesson(language, letter);
  if (!lesson) notFound();
  const { prev, next, index, total } = neighbours(language, letter);
  const nav = {
    prev: prev && { slug: prev.slug, character: prev.character },
    next: next && { slug: next.slug, character: next.character },
    index,
    total,
  };
  return <LessonView key={lesson.slug} lesson={lesson} nav={nav} meta={{ instruction: LANGUAGES[language].instruction }} />;
}

// Every letter is prerendered via generateStaticParams; Suspense keeps navigations instant.
export default function LessonPage({ params }: PageProps<"/early/[language]/[letter]">) {
  return <Suspense fallback={null}>{params.then((p) => <Content language={p.language} letter={p.letter} />)}</Suspense>;
}
