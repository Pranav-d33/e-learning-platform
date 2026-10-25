import { FEEDBACK_LINES } from "./feedback";
import { LANGUAGES, getLessons } from "./lessons";
import type { Language } from "./types";

export interface AudioClip {
  path: string;
  text: string;
  lang: Language;
}

/** Every bundled clip the studio references, with the sentence it must contain. */
export function audioManifest(): AudioClip[] {
  const clips = new Map<string, AudioClip>();
  const add = (path: string, text: string, lang: Language) => clips.set(path, { path, text, lang });

  for (const lang of ["en", "hi"] as Language[]) {
    const meta = LANGUAGES[lang];
    add(meta.instruction.audio, meta.instruction.text, lang);
    add(meta.traceIntro.audio, meta.traceIntro.text, lang);
    for (const [key, text] of Object.entries(FEEDBACK_LINES[lang])) add(`/audio/${lang}/fb-${key}.mp3`, text, lang);
    for (const lesson of getLessons(lang)) {
      add(lesson.audio.name, lesson.letterNameText, lang);
      add(lesson.audio.chant, lesson.chantText, lang);
      for (const w of lesson.exampleWords) add(w.audio, lang === "en" ? `${lesson.character} for ${w.word}` : `${lesson.character} से ${w.word}`, lang);
    }
  }
  return [...clips.values()];
}
