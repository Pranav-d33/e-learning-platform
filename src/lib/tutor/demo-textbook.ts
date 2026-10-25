import type { Difficulty, QuestionType, SourceDocument } from "./types";

/**
 * ORIGINAL sample content written for this prototype. It is not an official
 * textbook and is not aligned to any board's syllabus.
 */
export const DEMO_DOC_ID = "demo-reader";
export const DEMO_TITLE = "Sunny Steps — Class 1 English Reader (demo sample)";

export const DEMO_PAGES: { page: number; text: string }[] = [
  {
    page: 1,
    text: `Sunny Steps
A Class 1 English Reader — Demo Sample

This sample was written for the AI Learning Platform prototype. It is original demo content, not an official textbook.

Contents
Unit 1 — Our Garden (pages 2–3)
Unit 2 — Things That Fly (page 4)
Unit 3 — My Day (page 5)
Unit 4 — Animal Friends (pages 6–7)`,
  },
  {
    page: 2,
    text: `Unit 1 — Our Garden
Riya's Seeds

Riya found a small packet of seeds in her grandmother's cupboard. "These are sunflower seeds," said Grandmother. "If you plant them, they will grow into tall yellow flowers."

Riya dug five little holes in the soft soil near the wall. She put one seed in each hole and covered it gently. Every morning she watered the soil with her green watering can.

For many days, nothing happened. Riya felt sad. "Be patient," said Grandmother. "Seeds need water, sunlight and time."

One morning, Riya saw tiny green shoots pushing out of the soil. She clapped her hands and ran to tell Grandmother. By the end of the summer, the sunflowers were taller than Riya.`,
  },
  {
    page: 3,
    text: `Poem: Little Seed

A little seed lay fast asleep,
Under the soil, so soft and deep.
Down came the rain, pitter-pat,
The seed woke up and stretched like that!
Up came a shoot to see the sun,
Then leaves came out, one by one.
Now in the garden, tall and bright,
A flower nods from morning to night.

Think and talk: What did the little seed need to grow?`,
  },
  {
    page: 4,
    text: `Unit 2 — Things That Fly
Arun and the Red Kite

Arun had a bright red kite. One sunny morning, he ran to the big open ground near his house. The wind was soft that day, so his kite would not fly high.

His grandfather smiled and said, "It is not windy enough yet. Let us wait." Arun waited with his grandfather under a shady tree, and they counted birds together.

Soon the wind grew strong and the trees began to sway. Arun let the string out slowly, and his red kite rose higher and higher. It looked like a small red bird in the blue sky.`,
  },
  {
    page: 5,
    text: `Unit 3 — My Day
Meena's Morning

Meena wakes up at six o'clock every morning. First she brushes her teeth and washes her face with fresh water. Then she puts on her clean school uniform and combs her hair neatly.

Her school bag already holds her books, two pencils and an eraser. Before leaving, Meena drinks a glass of milk and eats a warm roti.

The yellow school bus comes at seven thirty and stops right in front of her house. Meena waves goodbye to her mother and hops happily up the steps of the bus.`,
  },
  {
    page: 6,
    text: `Unit 4 — Animal Friends
The Little Green Frog

The little green frog sat on a log. It jumped into the pond with one big hop, and the water went splash.

Along came a dog, wet from the rain. He sniffed at the log, hoping to find the little frog. The frog stayed still, as quiet as a stone, until the friendly dog trotted away.

Then the little green frog peeped out at last. It saw the wide blue sky, and it sang one happy croak.`,
  },
  {
    page: 7,
    text: `Word Corner

Words to know
kite — a light toy that flies in the wind on a long string.
seed — a tiny part of a plant that can grow into a new plant.
pond — a small area of still water.
uniform — the special clothes children wear to school.
patient — able to wait calmly.`,
  },
];

export function demoDocument(): SourceDocument {
  const now = "2026-10-24T00:00:00.000Z";
  return {
    id: DEMO_DOC_ID,
    title: DEMO_TITLE,
    originalFilename: "sunny-steps-demo.pdf",
    mimeType: "application/pdf",
    sizeBytes: 0,
    status: "ready",
    createdAt: now,
    updatedAt: now,
    grade: 1,
    subject: "English",
    pageCount: DEMO_PAGES.length,
    extractionMethod: "seeded-demo",
    errorMessage: null,
    chunkCount: 0, // filled in by the repository after chunking
    chapters: [],
    lowTextPages: [],
    isDemo: true,
    embedding: null,
    parts: { pages: 0, chunks: 0 },
  };
}

export interface BankCriterion {
  criterion: string;
  points: number;
  keywords: string[];
}

export interface BankItem {
  key: string;
  type: QuestionType;
  difficulty: Difficulty;
  objective: "vocabulary" | "recall" | "literal comprehension" | "inference";
  page: number;
  quote: string;
  questionText: string;
  options?: [string, string][]; // [id, text]
  correct?: string;
  expected: string;
  accepted?: string[];
  criteria?: BankCriterion[];
}

/** Original, reviewed seed questions tied to exact quotes in DEMO_PAGES. */
export const DEMO_BANK: BankItem[] = [
  // Riya's Seeds — page 2
  {
    key: "riya-seeds-kind", type: "mcq", difficulty: "easy", objective: "vocabulary", page: 2,
    quote: "\"These are sunflower seeds,\" said Grandmother.",
    questionText: "What kind of seeds did Riya find?",
    options: [["A", "Mango seeds"], ["B", "Sunflower seeds"], ["C", "Rice seeds"]], correct: "B", expected: "Sunflower seeds",
  },
  {
    key: "riya-holes", type: "mcq", difficulty: "easy", objective: "recall", page: 2,
    quote: "Riya dug five little holes in the soft soil near the wall.",
    questionText: "How many holes did Riya dig in the soil?",
    options: [["A", "Two"], ["B", "Five"], ["C", "Ten"]], correct: "B", expected: "Five",
  },
  {
    key: "riya-can", type: "fill_blank", difficulty: "easy", objective: "vocabulary", page: 2,
    quote: "Every morning she watered the soil with her green watering can.",
    questionText: "Every morning, Riya watered the soil with her green ___ can.",
    expected: "watering", accepted: ["watering", "watering can"],
  },
  {
    key: "riya-needs", type: "short_answer", difficulty: "medium", objective: "literal comprehension", page: 2,
    quote: "\"Seeds need water, sunlight and time.\"",
    questionText: "What did Grandmother say seeds need to grow?",
    expected: "Seeds need water, sunlight and time.",
    criteria: [
      { criterion: "Mentions water", points: 1, keywords: ["water", "rain"] },
      { criterion: "Mentions sunlight", points: 1, keywords: ["sun", "sunlight", "light"] },
      { criterion: "Mentions time or waiting", points: 1, keywords: ["time", "patient", "wait", "days"] },
    ],
  },
  {
    key: "riya-sad", type: "comprehension", difficulty: "challenging", objective: "inference", page: 2,
    quote: "For many days, nothing happened. Riya felt sad.",
    questionText: "Why did Riya feel sad?",
    expected: "Because for many days nothing happened — the seeds had not come up yet.",
    criteria: [
      { criterion: "Says nothing grew or happened yet", points: 1, keywords: ["nothing", "not grow", "did not grow", "didn't grow", "no plant", "no shoot", "not come"] },
      { criterion: "Links it to waiting many days", points: 1, keywords: ["many days", "days", "long time", "wait", "waited"] },
    ],
  },
  {
    key: "riya-shoots", type: "comprehension", difficulty: "medium", objective: "literal comprehension", page: 2,
    quote: "One morning, Riya saw tiny green shoots pushing out of the soil.",
    questionText: "What did Riya see one morning?",
    expected: "Tiny green shoots pushing out of the soil.",
    criteria: [
      { criterion: "Names the shoots or small plants", points: 1, keywords: ["shoot", "sprout", "plant", "green"] },
      { criterion: "Says they came out of the soil", points: 1, keywords: ["soil", "ground", "out"] },
    ],
  },
  // Little Seed — page 3
  {
    key: "poem-rain", type: "mcq", difficulty: "easy", objective: "recall", page: 3,
    quote: "Down came the rain, pitter-pat, The seed woke up and stretched like that!",
    questionText: "In the poem, what woke the little seed up?",
    options: [["A", "The wind"], ["B", "The rain"], ["C", "A bird"]], correct: "B", expected: "The rain",
  },
  {
    key: "poem-leaves", type: "fill_blank", difficulty: "easy", objective: "recall", page: 3,
    quote: "Then leaves came out, one by one.",
    questionText: "Complete the line from the poem: “Then leaves came out, one by ___.”",
    expected: "one", accepted: ["one"],
  },
  {
    key: "poem-sleep", type: "short_answer", difficulty: "challenging", objective: "literal comprehension", page: 3,
    quote: "A little seed lay fast asleep, Under the soil, so soft and deep.",
    questionText: "Where was the seed sleeping at the start of the poem?",
    expected: "Under the soil.",
    criteria: [{ criterion: "Says under the soil or in the ground", points: 1, keywords: ["soil", "ground", "earth", "mud"] }],
  },
  // Arun and the Red Kite — page 4
  {
    key: "kite-colour", type: "mcq", difficulty: "easy", objective: "vocabulary", page: 4,
    quote: "Arun had a bright red kite.",
    questionText: "What colour was Arun's kite?",
    options: [["A", "Blue"], ["B", "Green"], ["C", "Red"]], correct: "C", expected: "Red",
  },
  {
    key: "kite-wait", type: "mcq", difficulty: "medium", objective: "recall", page: 4,
    quote: "Arun waited with his grandfather under a shady tree, and they counted birds together.",
    questionText: "What did Arun and his grandfather do while they waited?",
    options: [["A", "They counted birds"], ["B", "They went home to sleep"], ["C", "They swam in a pond"]], correct: "A",
    expected: "They counted birds",
  },
  {
    key: "kite-bird", type: "fill_blank", difficulty: "easy", objective: "vocabulary", page: 4,
    quote: "It looked like a small red bird in the blue sky.",
    questionText: "Arun's kite looked like a small red ___ in the blue sky.",
    expected: "bird", accepted: ["bird"],
  },
  {
    key: "kite-why", type: "comprehension", difficulty: "medium", objective: "inference", page: 4,
    quote: "The wind was soft that day, so his kite would not fly high.",
    questionText: "At first, Arun's kite would not fly high. Why?",
    expected: "The wind was soft — it was not windy enough yet.",
    criteria: [
      { criterion: "Mentions the wind", points: 1, keywords: ["wind", "windy", "breeze", "air"] },
      { criterion: "Says the wind was too soft or weak", points: 1, keywords: ["soft", "not strong", "weak", "not enough", "gentle", "slow", "little", "less"] },
    ],
  },
  {
    key: "kite-string", type: "short_answer", difficulty: "challenging", objective: "literal comprehension", page: 4,
    quote: "Arun let the string out slowly, and his red kite rose higher and higher.",
    questionText: "When the wind grew strong, what did Arun do to help his kite rise higher?",
    expected: "He let the string out slowly.",
    criteria: [
      { criterion: "Mentions the string", points: 1, keywords: ["string", "thread", "dor", "manja"] },
      { criterion: "Says he let it out slowly", points: 1, keywords: ["let", "slowly", "loose", "out", "released", "gave"] },
    ],
  },
  // Meena's Morning — page 5
  {
    key: "meena-time", type: "mcq", difficulty: "easy", objective: "recall", page: 5,
    quote: "Meena wakes up at six o'clock every morning.",
    questionText: "What time does Meena wake up?",
    options: [["A", "Six o'clock"], ["B", "Eight o'clock"], ["C", "Seven thirty"]], correct: "A", expected: "Six o'clock",
  },
  {
    key: "meena-eraser", type: "fill_blank", difficulty: "easy", objective: "vocabulary", page: 5,
    quote: "Her school bag already holds her books, two pencils and an eraser.",
    questionText: "Meena's school bag holds her books, two pencils and an ___.",
    expected: "eraser", accepted: ["eraser", "rubber"],
  },
  {
    key: "meena-eat", type: "mcq", difficulty: "medium", objective: "recall", page: 5,
    quote: "Before leaving, Meena drinks a glass of milk and eats a warm roti.",
    questionText: "What does Meena eat before she leaves for school?",
    options: [["A", "A warm roti"], ["B", "A bowl of rice"], ["C", "An apple"]], correct: "A", expected: "A warm roti",
  },
  {
    key: "meena-ready", type: "short_answer", difficulty: "medium", objective: "literal comprehension", page: 5,
    quote: "First she brushes her teeth and washes her face with fresh water.",
    questionText: "Name two things Meena does first, before she puts on her uniform.",
    expected: "She brushes her teeth and washes her face.",
    criteria: [
      { criterion: "Brushes her teeth", points: 1, keywords: ["brush", "teeth", "tooth"] },
      { criterion: "Washes her face", points: 1, keywords: ["wash", "face"] },
    ],
  },
  {
    key: "meena-bus", type: "comprehension", difficulty: "easy", objective: "literal comprehension", page: 5,
    quote: "The yellow school bus comes at seven thirty and stops right in front of her house.",
    questionText: "How does Meena go to school?",
    expected: "By the yellow school bus.",
    criteria: [{ criterion: "Says she goes by school bus", points: 1, keywords: ["bus"] }],
  },
  // The Little Green Frog — page 6
  {
    key: "frog-splash", type: "mcq", difficulty: "easy", objective: "vocabulary", page: 6,
    quote: "It jumped into the pond with one big hop, and the water went splash.",
    questionText: "What sound did the water make when the frog jumped in?",
    options: [["A", "Splash"], ["B", "Croak"], ["C", "Woof"]], correct: "A", expected: "Splash",
  },
  {
    key: "frog-safe", type: "short_answer", difficulty: "medium", objective: "literal comprehension", page: 6,
    quote: "The frog stayed still, as quiet as a stone, until the friendly dog trotted away.",
    questionText: "How did the little frog stay safe when the dog came?",
    expected: "It stayed still and quiet until the dog went away.",
    criteria: [
      { criterion: "Says it stayed still or quiet", points: 1, keywords: ["still", "quiet", "silent", "not move", "did not move", "didn't move", "hid"] },
      { criterion: "Says it waited until the dog left", points: 1, keywords: ["went away", "trotted away", "left", "gone", "until", "away"] },
    ],
  },
  {
    key: "frog-stone", type: "fill_blank", difficulty: "medium", objective: "vocabulary", page: 6,
    quote: "The frog stayed still, as quiet as a stone, until the friendly dog trotted away.",
    questionText: "The frog stayed still, as quiet as a ___.",
    expected: "stone", accepted: ["stone"],
  },
  {
    key: "frog-happy", type: "comprehension", difficulty: "challenging", objective: "inference", page: 6,
    quote: "It saw the wide blue sky, and it sang one happy croak.",
    questionText: "Was the frog happy at the end of the story? How do you know?",
    expected: "Yes — it sang one happy croak.",
    criteria: [
      { criterion: "Says yes, the frog was happy", points: 1, keywords: ["yes", "happy", "glad"] },
      { criterion: "Gives the croak as evidence", points: 1, keywords: ["croak", "sang", "sing", "song"] },
    ],
  },
  // Word Corner — page 7
  {
    key: "word-patient", type: "mcq", difficulty: "medium", objective: "vocabulary", page: 7,
    quote: "patient — able to wait calmly.",
    questionText: "What does the word “patient” mean?",
    options: [["A", "Able to wait calmly"], ["B", "Able to run very fast"], ["C", "Very tall"]], correct: "A",
    expected: "Able to wait calmly",
  },
];
