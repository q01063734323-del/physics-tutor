import { gradeTrainerAnswer, type TrainerAnswer, type TrainerAsset, type TrainerQuestion } from "./trainer-bank";

export type TrainerCheckResult = {
  correct: boolean | null;
  feedback: string;
  answer: TrainerAnswer | null;
  solution: string | null;
  assets: TrainerAsset[];
};

// Answer descriptors let the existing form choose its input and units, while
// the actual key and source solution stay on the server until an attempt.
export function publicTrainerQuestion(question: TrainerQuestion): TrainerQuestion {
  const answer = question.answer;
  return {
    ...question,
    // OCR may include an adjacent answer column in source training tables.
    // Search the approved prompt, task label and topic metadata instead.
    searchText: undefined,
    answer: !answer ? null : answer.type === "numeric" ? { type: "numeric", expected: "", unit: answer.unit }
      : answer.type === "sequence" ? { type: "sequence", expected: [], compact: answer.compact, units: answer.units }
      : answer.type === "multi_select" ? { type: "multi_select", expected: [] } : { type: "manual" },
    solution: null,
    assets: question.assets.filter(asset => !["answer", "solution", "condition"].includes(asset.role || "")),
  };
}

export function checkPublishedAnswer(question: TrainerQuestion, input: string): TrainerCheckResult {
  return {
    ...gradeTrainerAnswer(question, input), answer: question.answer, solution: question.solution,
    assets: question.assets.filter(asset => asset.role === "solution"),
  };
}
