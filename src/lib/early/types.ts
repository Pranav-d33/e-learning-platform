export type Language = "en" | "hi";

export interface Point {
  x: number;
  y: number;
}

/** One authored pen stroke, in the 200×200 glyph grid. Direction = order of the path. */
export interface GuideStroke {
  id: number;
  d: string;
}

export type LessonGlyph =
  | { kind: "strokes"; viewBox: string; strokes: GuideStroke[] }
  /** Font outline (filled path). Used where reviewed stroke-order data does not exist yet. */
  | { kind: "outline"; viewBox: string; outline: string };

export interface ExampleWord {
  word: string;
  /** Picture key → /pictures/<key>.svg */
  image: string;
  /** Adult-facing hint, e.g. romanisation + meaning for Hindi words. */
  gloss?: string;
  audio: string;
}

export interface EarlyLesson {
  language: Language;
  /** ASCII, URL-safe identifier, e.g. "a" or "kha". */
  slug: string;
  character: string;
  displayName: string;
  letterNameText: string;
  /** Adult-facing phoneme cue; spoken teaching happens through the chant + words. */
  soundHintText: string;
  /** Spoken cue such as "A for apple" / "अ से अनार". */
  chantText: string;
  group: "vowel" | "consonant";
  exampleWords: ExampleWord[];
  instructionAudioText: string;
  glyph: LessonGlyph;
  audio: { name: string; chant: string };
  difficulty: "beginner";
  /** True only after a qualified adult has reviewed the content. */
  reviewed: boolean;
}

export interface LessonAttempt {
  language: Language;
  slug: string;
  character: string;
  attempts: number;
  bestCoverage: number;
  lastCoverage: number;
  completed: boolean;
  timestamp: number;
}
