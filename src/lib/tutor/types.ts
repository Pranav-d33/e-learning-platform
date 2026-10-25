export type QuestionType = "mcq" | "fill_blank" | "short_answer" | "comprehension";
export type Difficulty = "easy" | "medium" | "challenging";
export type GroundingStatus = "verified" | "needs_review" | "teacher_edited";
export type DocumentStatus = "uploading" | "extracting" | "indexing" | "ready" | "failed";
export type QuestionOrigin = "llm" | "demo_bank" | "demo_rule";

export const QUESTION_TYPES: QuestionType[] = ["mcq", "fill_blank", "short_answer", "comprehension"];
export const DIFFICULTIES: Difficulty[] = ["easy", "medium", "challenging"];

export const TYPE_LABEL: Record<QuestionType, string> = {
  mcq: "Multiple choice",
  fill_blank: "Fill in the blank",
  short_answer: "Short answer",
  comprehension: "Reading comprehension",
};

export interface Chapter {
  title: string;
  pageStart: number;
  pageEnd: number;
}

export interface SourceDocument {
  id: string;
  title: string;
  originalFilename: string;
  mimeType: string;
  sizeBytes: number;
  status: DocumentStatus;
  createdAt: string;
  updatedAt: string;
  grade: number;
  subject: string;
  pageCount: number;
  extractionMethod: "pdf-text-layer" | "seeded-demo";
  errorMessage: string | null;
  chunkCount: number;
  chapters: Chapter[];
  /** Pages whose text layer was empty or near-empty (likely scanned images). */
  lowTextPages: number[];
  isDemo: boolean;
  embedding: { model: string; dims: number } | null;
  parts: { pages: number; chunks: number };
}

export interface PageText {
  page: number;
  text: string;
  chapter: string | null;
}

export interface Chunk {
  id: string;
  documentId: string;
  documentTitle: string;
  pageNumber: number;
  chunkIndex: number;
  text: string;
  tokenEstimate: number;
  chapter: string | null;
  grade: number;
  subject: string;
  extractionMethod: SourceDocument["extractionMethod"];
  /** Base64 Float32 vector when an embedding provider is configured. */
  embedding?: string;
}

export interface SourceRef {
  documentId: string;
  documentTitle: string;
  page: number | null;
  chunkId: string;
  quote: string;
}

export interface RubricCriterion {
  id: string;
  criterion: string;
  points: number;
  /** Only used by the deterministic demo evaluator (keyword alternatives). */
  keywords?: string[];
}

export interface Rubric {
  maxScore: number;
  criteria: RubricCriterion[];
}

export interface Question {
  id: string;
  quizId: string;
  type: QuestionType;
  grade: number;
  subject: string;
  difficulty: Difficulty;
  learningObjective: string;
  questionText: string;
  passage: { text: string; page: number | null; title: string | null } | null;
  options: { id: string; text: string }[] | null;
  correctOptionId: string | null;
  expectedAnswer: string;
  acceptedAnswers: string[];
  rubric: Rubric;
  sourceRefs: SourceRef[];
  groundingStatus: GroundingStatus;
  groundingIssues: string[];
  teacherEdited: boolean;
  teacherNote: string | null;
  origin: QuestionOrigin;
}

export interface ChapterScope {
  chapter: string | null;
  pageFrom: number | null;
  pageTo: number | null;
}

export interface QuizConfig {
  documentId: string;
  grade: number;
  subject: string;
  scope: ChapterScope;
  questionCount: number;
  difficulty: Difficulty;
  questionTypes: QuestionType[];
  learningObjective: string;
}

export interface Quiz {
  id: string;
  title: string;
  documentIds: string[];
  grade: number;
  subject: string;
  chapterScope: ChapterScope;
  questionTypes: QuestionType[];
  difficulty: Difficulty;
  questionCount: number;
  learningObjective: string;
  status: "draft" | "ready";
  createdAt: string;
  updatedAt: string;
  generator: { mode: "live" | "demo"; model: string | null; retrieval: "bm25" | "hybrid" };
  warnings: string[];
  questions: Question[];
}

export interface AnswerInput {
  optionId?: string;
  text?: string;
}

export type Evaluator = "exact_option" | "normalized_match" | "llm_rubric" | "demo_keyword" | "none";

export interface AnswerEvaluation {
  id: string;
  attemptId: string;
  questionId: string;
  answerText: string | null;
  optionId: string | null;
  score: number;
  maxScore: number;
  feedback: string;
  matchedCriteria: string[];
  missingCriteria: string[];
  evaluator: Evaluator;
  reviewFlag: boolean;
  confidence: number | null;
}

export interface Attempt {
  id: string;
  quizId: string;
  startedAt: string;
  submittedAt: string | null;
  /** Display order of option ids per MCQ, independent of stored answer keys. */
  optionOrder: Record<string, string[]>;
  answers: Record<string, AnswerInput>;
  totalScore: number;
  maxScore: number;
  evaluationStatus: "in_progress" | "complete" | "needs_review";
  evaluations: AnswerEvaluation[];
}

/** What the student sees: never includes answer keys, rubrics' criteria, or evidence quotes. */
export interface StudentQuestion {
  id: string;
  type: QuestionType;
  questionText: string;
  passage: { text: string; title: string | null } | null;
  options: { id: string; label: string; text: string }[] | null;
  maxScore: number;
}
