import type { Metadata } from "next";
import { Suspense } from "react";
import { GamesView } from "@/components/early/games-view";

export const metadata: Metadata = { title: "Mini-Games · Early Learning Studio" };

export default function EarlyGamesPage() {
  return (
    <Suspense fallback={null}>
      <GamesView />
    </Suspense>
  );
}
