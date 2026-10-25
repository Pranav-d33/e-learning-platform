import type { EarlyLesson, ExampleWord, Language } from "./types";
import { EN_STROKES } from "./strokes-en";
import { HI_OUTLINES } from "./glyphs-hi";

const VIEWBOX = "0 0 200 200";

/* ------------------------------------------------------------------ English */

type EnRow = [letter: string, sound: string, words: [word: string, image: string][]];

const EN_ROWS: EnRow[] = [
  ["A", "short “a”, as in apple", [["apple", "apple"], ["ant", "ant"]]],
  ["B", "“b”, as in ball", [["ball", "ball"], ["banana", "banana"], ["bird", "bird"]]],
  ["C", "hard “c” (k), as in cat", [["cat", "cat"], ["cow", "cow"], ["cup", "cup"]]],
  ["D", "“d”, as in dog", [["dog", "dog"], ["duck", "duck"], ["door", "door"]]],
  ["E", "short “e”, as in egg", [["egg", "egg"], ["elephant", "elephant"]]],
  ["F", "“f”, as in fish", [["fish", "fish"], ["flower", "flower"]]],
  ["G", "hard “g”, as in goat", [["goat", "goat"], ["grapes", "grapes"], ["gift", "gift"]]],
  ["H", "“h”, as in hat", [["hat", "hat"], ["hen", "hen"], ["horse", "horse"]]],
  ["I", "short “i”, as in insect", [["insect", "insect"], ["ice cream", "ice-cream"]]],
  ["J", "“j”, as in juice", [["juice", "juice"], ["jeans", "jeans"]]],
  ["K", "“k”, as in kite", [["kite", "kite"], ["key", "key"], ["king", "king"]]],
  ["L", "“l”, as in lion", [["lion", "lion"], ["leaf", "leaf"], ["lamp", "lamp"]]],
  ["M", "“m”, as in monkey", [["monkey", "monkey"], ["moon", "moon"], ["milk", "milk"]]],
  ["N", "“n”, as in nest", [["nest", "nest"], ["nose", "nose"]]],
  ["O", "short “o”, as in octopus", [["octopus", "octopus"], ["orange", "orange"]]],
  ["P", "“p”, as in pen", [["pen", "pen"], ["pig", "pig"], ["parrot", "parrot"]]],
  ["Q", "“kw”, as in queen", [["queen", "queen"], ["question", "question"]]],
  ["R", "“r”, as in rabbit", [["rabbit", "rabbit"], ["rain", "rain"], ["ring", "ring"]]],
  ["S", "“s”, as in sun", [["sun", "sun"], ["star", "star"], ["sock", "sock"]]],
  ["T", "“t”, as in tiger", [["tiger", "tiger"], ["tree", "tree"], ["tap", "tap"]]],
  ["U", "short “u”, as in umbrella", [["umbrella", "umbrella"], ["unicorn", "unicorn"]]],
  ["V", "“v”, as in van", [["van", "van"], ["violin", "violin"]]],
  ["W", "“w”, as in watch", [["watch", "watch"], ["watermelon", "watermelon"], ["window", "window"]]],
  ["X", "“ks”, as at the end of box", [["box", "box"], ["x-ray", "x-ray"]]],
  ["Y", "“y”, as in yo-yo", [["yo-yo", "yo-yo"], ["yarn", "yarn"], ["yellow", "yellow"]]],
  ["Z", "“z”, as in zebra", [["zebra", "zebra"], ["zero", "zero"]]],
];

const EN_VOWELS = new Set(["A", "E", "I", "O", "U"]);

export function audioSlug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

const EN_LESSONS: EarlyLesson[] = EN_ROWS.map(([letter, sound, words]) => {
  const slug = letter.toLowerCase();
  return {
    language: "en",
    slug,
    character: letter,
    displayName: `Letter ${letter}`,
    letterNameText: letter,
    soundHintText: sound,
    chantText: `${letter} for ${words[0][0]}`,
    group: EN_VOWELS.has(letter) ? "vowel" : "consonant",
    exampleWords: words.map(
      ([word, image]): ExampleWord => ({ word, image, audio: `/audio/en/word-${audioSlug(word)}.mp3` }),
    ),
    instructionAudioText: "Listen, then trace the letter.",
    glyph: { kind: "strokes", viewBox: VIEWBOX, strokes: EN_STROKES[letter] },
    audio: { name: `/audio/en/name-${slug}.mp3`, chant: `/audio/en/chant-${slug}.mp3` },
    difficulty: "beginner",
    reviewed: false,
  };
});

/* -------------------------------------------------------------------- Hindi */

type HiRow = [
  char: string,
  slug: string,
  roman: string,
  group: "vowel" | "consonant",
  words: [word: string, image: string, gloss: string, audioKey: string][],
];

const HI_ROWS: HiRow[] = [
  ["अ", "a", "a", "vowel", [["अनार", "pomegranate", "anaar · pomegranate", "anaar"], ["अंगूर", "grapes", "angoor · grapes", "angoor"]]],
  ["आ", "aa", "aa", "vowel", [["आम", "mango", "aam · mango", "aam"], ["आलू", "potato", "aaloo · potato", "aaloo"]]],
  ["इ", "i", "i", "vowel", [["इन्द्रधनुष", "rainbow", "indradhanush · rainbow", "indradhanush"], ["इंजन", "engine", "injan · engine", "injan"]]],
  ["ई", "ii", "ee", "vowel", [["ईंट", "brick", "eent · brick", "eent"], ["ईख", "sugarcane", "eekh · sugarcane", "eekh"]]],
  ["उ", "u", "u", "vowel", [["उल्लू", "owl", "ullu · owl", "ullu"], ["उँगली", "finger", "ungli · finger", "ungli"]]],
  ["ऊ", "uu", "oo", "vowel", [["ऊँट", "camel", "oont · camel", "oont"], ["ऊन", "yarn", "oon · wool", "oon"]]],
  ["ए", "e", "e", "vowel", [["एक", "one", "ek · one", "ek"]]],
  ["ऐ", "ai", "ai", "vowel", [["ऐनक", "glasses", "ainak · spectacles", "ainak"]]],
  ["ओ", "o", "o", "vowel", [["ओस", "dew", "os · dew drop", "os"]]],
  ["औ", "au", "au", "vowel", [["औज़ार", "tools", "auzaar · tools", "auzaar"], ["औरत", "woman", "aurat · woman", "aurat"]]],
  ["क", "ka", "ka", "consonant", [["कबूतर", "pigeon", "kabootar · pigeon", "kabootar"], ["कमल", "lotus", "kamal · lotus", "kamal"]]],
  ["ख", "kha", "kha", "consonant", [["खरगोश", "rabbit", "khargosh · rabbit", "khargosh"], ["खिलौना", "toy", "khilauna · toy", "khilauna"]]],
  ["ग", "ga", "ga", "consonant", [["गाय", "cow", "gaay · cow", "gaay"], ["गेंद", "ball", "gend · ball", "gend"]]],
  ["घ", "gha", "gha", "consonant", [["घर", "house", "ghar · house", "ghar"], ["घड़ी", "clock", "ghadi · clock", "ghadi"]]],
  ["च", "cha", "cha", "consonant", [["चम्मच", "spoon", "chammach · spoon", "chammach"], ["चाबी", "key", "chaabi · key", "chaabi"]]],
  ["छ", "chha", "chha", "consonant", [["छाता", "umbrella", "chhaata · umbrella", "chhaata"], ["छिपकली", "lizard", "chhipkali · lizard", "chhipkali"]]],
  ["ज", "ja", "ja", "consonant", [["जहाज़", "ship", "jahaaz · ship", "jahaaz"], ["जूता", "shoe", "joota · shoe", "joota"]]],
  ["ट", "tta", "ṭa", "consonant", [["टमाटर", "tomato", "tamaatar · tomato", "tamaatar"], ["टोपी", "cap", "topi · cap", "topi"]]],
];

const HI_LESSONS: EarlyLesson[] = HI_ROWS.map(([char, slug, roman, group, words]) => ({
  language: "hi",
  slug,
  character: char,
  displayName: `अक्षर ${char}`,
  letterNameText: char,
  soundHintText: `“${roman}”, as in ${words[0][0]} (${words[0][2].split(" · ")[0]})`,
  chantText: `${char} से ${words[0][0]}`,
  group,
  exampleWords: words.map(
    ([word, image, gloss, key]): ExampleWord => ({ word, image, gloss, audio: `/audio/hi/word-${key}.mp3` }),
  ),
  instructionAudioText: "सुनो, फिर अक्षर लिखो।",
  glyph: { kind: "outline", viewBox: VIEWBOX, outline: HI_OUTLINES[char] ?? "" },
  audio: { name: `/audio/hi/name-${slug}.mp3`, chant: `/audio/hi/chant-${slug}.mp3` },
  difficulty: "beginner",
  reviewed: false,
}));

/* --------------------------------------------------------------- Shared UI */

export const LANGUAGES: Record<
  Language,
  {
    code: Language;
    label: string;
    nativeLabel: string;
    speechLang: string;
    instruction: { text: string; audio: string };
    traceIntro: { text: string; audio: string };
  }
> = {
  en: {
    code: "en",
    label: "English",
    nativeLabel: "English",
    speechLang: "en-IN",
    instruction: { text: "Listen, then trace the letter.", audio: "/audio/en/instr-listen.mp3" },
    traceIntro: {
      text: "Start at the green dot and follow the arrows with your finger.",
      audio: "/audio/en/instr-trace.mp3",
    },
  },
  hi: {
    code: "hi",
    label: "Hindi",
    nativeLabel: "हिंदी",
    speechLang: "hi-IN",
    instruction: { text: "सुनो, फिर अक्षर लिखो।", audio: "/audio/hi/instr-listen.mp3" },
    traceIntro: {
      text: "हल्के अक्षर के ऊपर उँगली चलाओ। ऊपर की लाइन सबसे आख़िर में बनाओ।",
      audio: "/audio/hi/instr-trace.mp3",
    },
  },
};

const ALL: Record<Language, EarlyLesson[]> = { en: EN_LESSONS, hi: HI_LESSONS };

export function isLanguage(value: string): value is Language {
  return value === "en" || value === "hi";
}

export function getLessons(language: Language): EarlyLesson[] {
  return ALL[language];
}

export function getLesson(language: Language, slug: string): EarlyLesson | undefined {
  return ALL[language].find((l) => l.slug === slug);
}

export function neighbours(language: Language, slug: string) {
  const list = ALL[language];
  const i = list.findIndex((l) => l.slug === slug);
  return { prev: i > 0 ? list[i - 1] : null, next: i >= 0 && i < list.length - 1 ? list[i + 1] : null, index: i, total: list.length };
}

/** Lightweight listing for grids and the lessons API. */
export function lessonSummaries(language: Language) {
  return ALL[language].map((l) => ({
    language: l.language,
    slug: l.slug,
    character: l.character,
    displayName: l.displayName,
    group: l.group,
    reviewed: l.reviewed,
    hasStrokeOrder: l.glyph.kind === "strokes",
  }));
}

export function allLessonParams() {
  return (Object.keys(ALL) as Language[]).flatMap((language) =>
    ALL[language].map((l) => ({ language, letter: l.slug })),
  );
}
