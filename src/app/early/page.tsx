import { EarlyHome } from "@/components/early/home";
import { getLessons } from "@/lib/early/lessons";

export default function EarlyPage() {
  const slugs = { en: getLessons("en").map((l) => l.slug), hi: getLessons("hi").map((l) => l.slug) };
  return <EarlyHome slugs={slugs} />;
}
