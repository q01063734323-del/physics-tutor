import type { TrainerAnswer, PhysicsSection, TrainerQuestion } from "./trainer-bank";

export type PdfDraftFragment = { asset: string; pdfPage: number; bbox: [number, number, number, number]; role: "condition" | "solution" | "context" };
export type PdfDraftExercise = {
  id: string;
  version: string;
  chapterId: number;
  chapter: string;
  section: PhysicsSection;
  topics: string[];
  kind: "typical" | "control" | "diagnostic" | "final" | "training";
  label: string;
  sourceExerciseNumber: number | null;
  sourceExamNumber: number | null;
  numberStatus: "source_checked" | "candidate" | "unreadable";
  ocrText: string;
  fragments: PdfDraftFragment[];
  answerPages: number[];
  answer: TrainerAnswer | null;
  answerCandidate?: { text: string; confidence: number; pdfPage: number; asset: string; status: "needs_review"; sourceTable: string } | null;
  solution: string | null;
  solutionCandidate?: { fragments: PdfDraftFragment[]; status: "needs_review"; sourceLabel: string } | null;
  pilotQuestionId: string | null;
  review: { status: "needs_review" | "source_checked"; issues: string[]; evidence?: { conditionPages: number[]; answerPage: number; note: string }; checkedAt?: string };
  verifiedPrompt?: string;
  verifiedRepresentation?: "source_scan" | "transcribed";
  verifiedFigures?: PdfDraftFragment[];
  verifiedSolutionFragments?: PdfDraftFragment[];
  rights: "unknown";
};

export type PdfDraftBank = {
  schemaVersion: 2;
  sourceId: string;
  title: string;
  pages: number;
  questions: PdfDraftExercise[];
  assets: string[];
  summary: {
    detectedExercises: number;
    sourceChecked: number;
    needsReview: number;
    unknownNumbers: number;
    trainingExercises: number;
    answerCandidates?: number;
    solutionCandidates?: number;
    duplicateCount: number;
    unresolvedPages: { pdfPage: number; reason: string }[];
    warnings: string[];
    reimport: { added: number; updated: number; unchanged: number };
  };
};

export const draftKindLabels: Record<PdfDraftExercise["kind"], string> = {
  typical: "Типовые задания", control: "Тематический контроль", diagnostic: "Входная диагностика", final: "Итоговый контроль", training: "Упражнения с разбором",
};

export type PdfDraftFilters = { mode: "numbers" | "topics"; number: string; section: string; topic: string; kind: string; review: string; query: string };
export const initialPdfDraftFilters: PdfDraftFilters = { mode: "numbers", number: "all", section: "all", topic: "all", kind: "all", review: "all", query: "" };

export function filterPdfDrafts(questions: PdfDraftExercise[], filters: PdfDraftFilters) {
  const query = filters.query.trim().toLocaleLowerCase("ru");
  return questions.filter(question => {
    if (filters.mode === "numbers" && filters.number !== "all" && (filters.number === "unknown" ? question.sourceExamNumber !== null : question.sourceExamNumber !== Number(filters.number))) return false;
    if (filters.mode === "topics" && filters.section !== "all" && question.section !== filters.section) return false;
    if (filters.mode === "topics" && filters.topic !== "all" && !question.topics.includes(filters.topic)) return false;
    if (filters.kind !== "all" && question.kind !== filters.kind) return false;
    if (filters.review !== "all" && question.review.status !== filters.review) return false;
    return !query || [question.label, question.chapter, question.ocrText, ...question.topics, ...question.fragments.map(fragment => `страница ${fragment.pdfPage}`)].join(" ").toLocaleLowerCase("ru").includes(query);
  });
}

export function privatePdfAsset(asset: string, batch: "pilot" | "full" = "full") {
  return `/api/pdf-import-preview?batch=${batch}&asset=${encodeURIComponent(asset)}`;
}

// Verification enables local practice only. Teacher approval and rights stay
// pending, so the standard publishing gate continues to reject these records.
export function verifiedDraftToTrainer(question: PdfDraftExercise, sourceId: string, title: string): TrainerQuestion | null {
  if (question.review.status !== "source_checked" || !question.answer) return null;
  return {
    id: question.id, version: question.version, origin: "pdf", exam: "ЕГЭ",
    examNumber: question.sourceExamNumber, examYear: 2026,
    mapping: { status: question.sourceExamNumber ? "confirmed" : "unmapped", evidence: "Печатная метка сверена с оригинальным PDF; права и утверждение преподавателем ожидаются." },
    section: question.section, topics: question.topics,
    prompt: question.verifiedPrompt || `${question.label}. Реши задачу по полному оригинальному условию ниже. Скан можно увеличить.`,
    searchText: question.ocrText,
    assets: [...(question.verifiedPrompt ? question.verifiedFigures || [] : question.fragments.filter(fragment => fragment.role === "condition")).map((fragment, index) => ({ id: `${fragment.asset}-${index}`, role: question.verifiedPrompt ? "diagram" as const : "scan" as const, url: privatePdfAsset(fragment.asset), alt: `${question.label}. ${question.verifiedPrompt ? "Рисунок" : "Полное условие"}, PDF с. ${fragment.pdfPage}` })), ...(question.verifiedSolutionFragments || []).map((fragment, index) => ({ id: `solution-${fragment.asset}-${index}`, role: "solution" as const, url: privatePdfAsset(fragment.asset), alt: `${question.label}. Решение из источника, PDF с. ${fragment.pdfPage}` }))],
    answer: question.answer, solution: question.solution,
    source: { id: sourceId, sha256: sourceId, title, pdfPage: question.fragments[0].pdfPage, taskLabel: question.label, answerPage: question.review.evidence?.answerPage || question.answerCandidate?.pdfPage || null },
    rights: { status: "unknown", note: "Закрытый проверочный набор. Разрешение на публикацию не подтверждено." },
    review: { status: "needs_review", conditionComplete: true, answerCheckedAgainstSource: true, figuresChecked: true, mathChecked: true, issues: ["Сверено с PDF; утверждение преподавателем и права ожидаются."] },
  };
}
