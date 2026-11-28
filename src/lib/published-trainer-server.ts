import "server-only";
import published from "../../data/trainer/physics-2026.json";
import { canPublishQuestion, type TrainerQuestion } from "./trainer-bank";
import { publicTrainerQuestion } from "./trainer-public";
import legacyAttempts from "../../data/trainer/legacy-attempt-index.json";
import type { LearningAttempt, TaskMeta } from "./command-center/analytics";

export const publishedTrainerQuestions = (published.questions as TrainerQuestion[]).filter(canPublishQuestion);
export const publishedTrainerVersion = published.version;
export const publishedTrainerCatalog = publishedTrainerQuestions.map(publicTrainerQuestion);
export const publishedTrainerById = new Map(publishedTrainerQuestions.map(question => [question.id, question]));

const historicalById = new Map(legacyAttempts.map((task): [string, TaskMeta] => [task.id, task]));

export function trainerHistoryCatalog(attempts: LearningAttempt[]): TaskMeta[] {
  const historical = new Map<string, TaskMeta>();
  for (const attempt of attempts) {
    const task = historicalById.get(attempt.taskId);
    if (task?.version === attempt.taskVersion) historical.set(task.id, task);
  }
  return [...publishedTrainerCatalog, ...historical.values()];
}
