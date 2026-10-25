import type { TraceScore } from "./geometry";
import type { Language } from "./types";

export type FeedbackTone = "idle" | "great" | "partial" | "retry";

export interface SpokenLine {
  text: string;
  audio: string;
}

const EN_NUMBER_WORDS = ["one", "two", "three", "four"];

/** Every fixed sentence the studio can speak, keyed by clip name. Feeds the audio generator. */
export const FEEDBACK_LINES: Record<Language, Record<string, string>> = {
  en: {
    empty: "Draw on the light letter with your finger.",
    great: "Wonderful! You traced it.",
    partial: "Good try! Trace the missing part again.",
    "line-1": "Good try! Trace line one again.",
    "line-2": "Good try! Trace line two again.",
    "line-3": "Good try! Trace line three again.",
    "line-4": "Good try! Trace line four again.",
    retry: "Let's try again. Follow the light letter.",
    offtrack: "Lovely colours! Now stay on the light letter.",
  },
  hi: {
    empty: "हल्के अक्षर पर उँगली से लिखो।",
    great: "शाबाश! तुमने अक्षर बना लिया।",
    partial: "अच्छी कोशिश! बचा हुआ हिस्सा फिर से बनाओ।",
    top: "अच्छी कोशिश! ऊपर की लाइन फिर से बनाओ।",
    left: "अच्छी कोशिश! बायाँ हिस्सा फिर से बनाओ।",
    right: "अच्छी कोशिश! दायाँ हिस्सा फिर से बनाओ।",
    retry: "चलो, फिर से कोशिश करें। हल्के अक्षर पर उँगली चलाओ।",
    offtrack: "बहुत सुंदर रंग! अब हल्के अक्षर के ऊपर ही लिखो।",
  },
};

function line(lang: Language, key: string): SpokenLine {
  return { text: FEEDBACK_LINES[lang][key], audio: `/audio/${lang}/fb-${key}.mp3` };
}

/** Gentle, non-punitive feedback for a scored trace. Never blocks progression. */
export function traceFeedback(lang: Language, score: TraceScore): { tone: FeedbackTone; spoken: SpokenLine } {
  switch (score.verdict) {
    case "empty":
      return { tone: "idle", spoken: line(lang, "empty") };
    case "great":
      return { tone: "great", spoken: line(lang, "great") };
    case "offtrack":
      return { tone: "retry", spoken: line(lang, "offtrack") };
    case "retry":
      return { tone: "retry", spoken: line(lang, "retry") };
    case "partial": {
      const weak = score.weakest;
      if (lang === "en" && weak && Number(weak.label) >= 1 && Number(weak.label) <= EN_NUMBER_WORDS.length)
        return { tone: "partial", spoken: line(lang, `line-${weak.label}`) };
      if (lang === "hi" && weak && ["top", "left", "right"].includes(weak.label))
        return { tone: "partial", spoken: line(lang, weak.label) };
      return { tone: "partial", spoken: line(lang, "partial") };
    }
  }
}
