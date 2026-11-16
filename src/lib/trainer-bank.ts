import type { BankQuestion } from "./question-bank";
import { gradeNumericAnswer, gradeMultiSelect, gradeSequence } from "./grading";

export type PhysicsSection = "Механика" | "Молекулярная физика и термодинамика" | "Электродинамика" | "Оптика" | "Квантовая физика" | "Эксперимент и анализ данных";
export type TrainerAnswer =
  | { type: "numeric"; expected: string; tolerance?: number; unit?: string }
  | { type: "sequence"; expected: string[]; compact?: boolean; units?: string[] }
  | { type: "multi_select"; expected: number[] }
  | { type: "manual"; expected?: string };

export type TrainerAsset = {
  id: string;
  role?: "diagram" | "condition" | "answer" | "solution";
  url: string;
  alt: string;
  sha256?: string;
  pdfPage?: number;
  bbox?: [number, number, number, number];
};

export type TrainerQuestion = {
  id: string;
  version: string;
  origin: "legacy" | "pdf" | "original";
  exam: "ЕГЭ" | "ОГЭ";
  examNumber: number | null;
  examYear: number | null;
  mapping: { status: "confirmed" | "unmapped"; evidence: string };
  section: PhysicsSection;
  topics: string[];
  prompt: string;
  assets: TrainerAsset[];
  answer: TrainerAnswer | null;
  solution: string | null;
  source: {
    id: string;
    title: string;
    sha256?: string;
    pdfPage: number | null;
    printedPage?: number | null;
    taskLabel: string;
    answerPage: number | null;
    solutionPage?: number | null;
  };
  rights: { status: "unknown" | "approved" | "legacy_unreviewed"; note: string; license?: string; evidence?: string };
  review: {
    status: "needs_review" | "verified";
    conditionComplete: boolean;
    answerCheckedAgainstSource: boolean;
    figuresChecked: boolean;
    mathChecked: boolean;
    issues: string[];
  };
};

export type TrainerAttempt = { id: string; questionId: string; version: string; input: string; correct: boolean | null; createdAt: string };
export type TrainerFilters = { mode: "numbers" | "topics"; number: number | "all" | "unmapped"; section: string; topic: string; query: string; progress: "all" | "new" | "mistakes" | "solved" };

export const physicsSections: PhysicsSection[] = ["Механика", "Молекулярная физика и термодинамика", "Электродинамика", "Оптика", "Квантовая физика", "Эксперимент и анализ данных"];
export const initialTrainerFilters: TrainerFilters = { mode: "numbers", number: "all", section: "all", topic: "all", query: "", progress: "all" };

export function inferLegacySection(topic: string): PhysicsSection {
  if (/оптик/i.test(topic)) return "Оптика";
  if (/квант|атом|ядер/i.test(topic)) return "Квантовая физика";
  if (/молекул|термодин/i.test(topic)) return "Молекулярная физика и термодинамика";
  if (/электр|магнит/i.test(topic)) return "Электродинамика";
  if (/эксперимент|график|таблиц/i.test(topic)) return "Эксперимент и анализ данных";
  return "Механика";
}

// Old tasks retain their existing visibility; this is not a claim about their rights.
export function adaptLegacyQuestion(question: BankQuestion): TrainerQuestion {
  return {
    id: question.id, version: "legacy-1", origin: "legacy", exam: question.exam,
    examNumber: null, examYear: null, mapping: { status: "unmapped", evidence: "В исходной записи нет подтверждённого номера ЕГЭ." },
    section: inferLegacySection(question.topic), topics: [question.topic, question.subtopic].filter(Boolean),
    prompt: question.prompt, assets: [], answer: question.answerType === "numeric" ? { type: "numeric", expected: question.answer } : { type: "manual", expected: question.answer },
    solution: question.solution || null,
    source: { id: "existing-bank", title: question.source, pdfPage: null, taskLabel: question.id, answerPage: null },
    rights: { status: "legacy_unreviewed", note: "Существующая запись, отдельная проверка прав не проводилась." },
    review: { status: question.verification, conditionComplete: Boolean(question.prompt), answerCheckedAgainstSource: question.verification === "verified", figuresChecked: true, mathChecked: question.verification === "verified", issues: [] },
  };
}

export function canPublishQuestion(question: TrainerQuestion): boolean {
  return question.rights.status === "approved" && question.review.status === "verified" && question.review.conditionComplete && question.review.figuresChecked && question.review.mathChecked && Boolean(question.answer) && question.review.answerCheckedAgainstSource;
}

export function isStudentQuestion(question: TrainerQuestion): boolean {
  return question.origin === "legacy" ? question.review.status === "verified" : canPublishQuestion(question);
}

export function validateTrainerQuestion(question: TrainerQuestion): string[] {
  const errors: string[] = [];
  if (!question.id || !question.version || !question.prompt.trim()) errors.push("Нет ID, версии или полного условия.");
  if (!question.topics.length || !physicsSections.includes(question.section)) errors.push("Не указан раздел или тема.");
  if (question.examNumber !== null && (!Number.isInteger(question.examNumber) || question.examNumber < 1 || question.examNumber > 40 || question.mapping.status !== "confirmed" || !question.mapping.evidence.trim())) errors.push("Номер экзамена не подтверждён источником.");
  if (question.origin === "pdf" && (!question.source.sha256 || !Number.isInteger(question.source.pdfPage) || (question.source.pdfPage ?? 0) < 1 || !question.source.taskLabel)) errors.push("Нет привязки к исходному PDF и странице.");
  if (question.answer?.type === "numeric" && (!question.answer.expected.trim() || !Number.isFinite(Number(question.answer.expected.replace(",", "."))))) errors.push("Некорректный числовой эталон.");
  for (const asset of question.assets) if (!asset.alt.trim() || !/^(\/api\/pdf-import-preview\?|\/|https:\/\/)/.test(asset.url) || asset.url.startsWith("//")) errors.push("Некорректный адрес или подпись рисунка.");
  return errors;
}

// Stable source IDs are authoritative. A different version updates one record,
// never creates a second copy just because it belongs to two topics.
export function mergeTrainerQuestions(existing: TrainerQuestion[], incoming: TrainerQuestion[]) {
  const map = new Map(existing.map(question => [question.id, question]));
  const errors: { id: string; errors: string[] }[] = [];
  let added = 0, updated = 0, unchanged = 0;
  for (const question of incoming) {
    const invalid = validateTrainerQuestion(question);
    if (invalid.length) { errors.push({ id: question.id, errors: invalid }); continue; }
    const previous = map.get(question.id);
    if (previous?.version === question.version) { unchanged++; continue; }
    if (previous) updated++; else added++;
    map.set(question.id, question);
  }
  return { questions: [...map.values()], added, updated, unchanged, errors };
}

export function latestAttempt(question: TrainerQuestion, attempts: TrainerAttempt[]) {
  return attempts.findLast(attempt => attempt.questionId === question.id && attempt.version === question.version);
}

export function filterTrainerQuestions(questions: TrainerQuestion[], filters: TrainerFilters, attempts: TrainerAttempt[] = []) {
  const query = filters.query.trim().toLocaleLowerCase("ru");
  return questions.filter(question => {
    if (filters.mode === "numbers" && filters.number !== "all" && (filters.number === "unmapped" ? question.examNumber !== null : question.examNumber !== filters.number)) return false;
    if (filters.mode === "topics" && filters.section !== "all" && question.section !== filters.section) return false;
    if (filters.mode === "topics" && filters.topic !== "all" && !question.topics.includes(filters.topic)) return false;
    if (query && ![question.id, question.prompt, question.section, ...question.topics, question.source.taskLabel].join(" ").toLocaleLowerCase("ru").includes(query)) return false;
    const last = latestAttempt(question, attempts);
    return filters.progress === "all" || (filters.progress === "new" && !last) || (filters.progress === "mistakes" && last?.correct === false) || (filters.progress === "solved" && last?.correct === true);
  });
}

export function gradeTrainerAnswer(question: TrainerQuestion, input: string): { correct: boolean | null; feedback: string } {
  const answer = question.answer;
  if (!input.trim()) return { correct: null, feedback: "Сначала введи свой ответ." };
  if (!answer || answer.type === "manual") return { correct: null, feedback: "Автопроверка недоступна. Ответ сохранён для разбора с преподавателем." };
  if (answer.type === "numeric") {
    const expected = Number(answer.expected.replace(",", "."));
    const result = gradeNumericAnswer(input, expected, { tolerance: answer.tolerance ?? 0 });
    return { correct: result.correct, feedback: result.correct ? "Верно. Отличная работа." : result.reason || "Пока неверно. Сверь единицы измерения и вычисления." };
  }
  if (answer.type === "sequence") {
    const normalized = answer.compact ? input.replace(/[\s;,]/g, "").split("") : input.split(/[;\s]+/).filter(Boolean);
    // Sequence positions are significant; leading zeroes must be retained.
    const expected = answer.expected;
    const numeric = expected.every(part => part.trim() && Number.isFinite(Number(part.replace(",", "."))));
    const correct = !answer.compact && numeric
      ? gradeSequence(input, expected.map(part => Number(part.replace(",", ".")))).correct
      : normalized.length === expected.length && normalized.every((part, index) => part.replace(",", ".") === expected[index].replace(",", "."));
    return { correct, feedback: correct ? "Верно. Все позиции совпали." : "Проверь порядок значений в ответе." };
  }
  const values = input.trim().split(/[;\s,]+/).filter(Boolean);
  const selected = values.length === 1 && /^\d{2,}$/.test(values[0]) ? values[0].split("").map(Number) : values.map(Number);
  const valid = selected.every(value => Number.isInteger(value) && value > 0) && new Set(selected).size === selected.length;
  const correct = valid && gradeMultiSelect(selected, answer.expected).correct;
  return { correct, feedback: correct ? "Верно. Выбраны все нужные утверждения." : "Проверь набор выбранных утверждений." };
}

export function displayTrainerAnswer(answer: TrainerAnswer | null) {
  if (!answer) return "В источнике не найден — автопроверка отключена";
  if (answer.type === "numeric") return `${answer.expected}${answer.unit ? ` ${answer.unit}` : ""}`;
  if (answer.type === "manual") return answer.expected || "Проверяется преподавателем";
  if (answer.type === "sequence" && answer.units) return answer.expected.map((part, index) => `${part}${answer.units?.[index] ? ` ${answer.units[index]}` : ""}`).join("; ");
  return answer.expected.join(answer.type === "sequence" && answer.compact ? "" : "; ");
}

export function trainerProgress(questions: TrainerQuestion[], attempts: TrainerAttempt[]) {
  const latest = questions.map(question => latestAttempt(question, attempts));
  return { total: questions.length, attempted: latest.filter(Boolean).length, solved: latest.filter(attempt => attempt?.correct === true).length, mistakes: latest.filter(attempt => attempt?.correct === false).length };
}
