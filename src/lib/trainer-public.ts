import { gradeTrainerAnswer, type TrainerAnswer, type TrainerAsset, type TrainerQuestion } from "./trainer-bank";

export type TrainerCheckResult = {
  correct: boolean | null;
  feedback: string;
  answer: TrainerAnswer | null;
  solution: string | null;
  assets: TrainerAsset[];
};

// A reverse proxy can give Next.js an internal request URL. Compare with an
// explicitly configured public origin too, never with arbitrary forwarded headers.
export function trainerOriginAllowed(origin: string | null, requestUrl: string, publicUrl: string): boolean {
  if (!origin) return true;
  try {
    const incoming = new URL(origin), target = new URL(requestUrl);
    if (origin === target.origin) return true;
    // Next may canonicalize a local request to localhost even when the browser
    // opened 127.0.0.1. Limit aliasing to loopback, identical port and protocol.
    const loopback = new Set(["localhost", "127.0.0.1", "[::1]"]);
    if (loopback.has(incoming.hostname) && loopback.has(target.hostname)
      && incoming.port === target.port && incoming.protocol === target.protocol) return true;
    return origin === new URL(publicUrl).origin;
  } catch { return false; }
}

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
