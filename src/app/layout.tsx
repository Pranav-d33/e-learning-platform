import type { Metadata, Viewport } from "next";
import { Baloo_2, Figtree, Fraunces, Geist_Mono } from "next/font/google";
import "./globals.css";

const fraunces = Fraunces({ variable: "--font-fraunces", subsets: ["latin"], axes: ["opsz", "SOFT"] });
const figtree = Figtree({ variable: "--font-figtree", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
const baloo = Baloo_2({ variable: "--font-baloo", subsets: ["latin", "devanagari"], weight: ["500", "600", "700", "800"] });

export const metadata: Metadata = {
  title: { default: "AI Learning Platform", template: "%s · AI Learning Platform" },
  description:
    "A prototype with two learning modules: a textbook tutor that writes source-cited quizzes, and an audio-first letter tracing studio for English and Hindi.",
  applicationName: "AI Learning Platform",
};

export const viewport: Viewport = {
  themeColor: "#f8f4ec",
  colorScheme: "light",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${fraunces.variable} ${figtree.variable} ${geistMono.variable} ${baloo.variable} h-full`}>
      <body className="flex min-h-full flex-col">
        <a
          href="#main"
          className="sr-only z-50 rounded-lg bg-ink px-4 py-2 text-paper focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
        >
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
