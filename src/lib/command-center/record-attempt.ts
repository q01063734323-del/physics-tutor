import "server-only";
import { createHash } from "node:crypto";
import { preparationAccess } from "./access";
import { checkPublishedAnswer } from "../trainer-public";
import { publishedTrainerById } from "../published-trainer-server";
export async function recordPreparationAttempt(request: Request, input: { attemptId: string; taskId: string; version: string; answer: string }) {
  if (!/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/.test(input.attemptId) || input.answer.length > 500 || !input.answer.trim()) throw new Error("400");
  const access = await preparationAccess(request);
  const task = publishedTrainerById.get(input.taskId);
  if (!task || task.version !== input.version) throw new Error("409");
  const checked = checkPublishedAnswer(task, input.answer);
  const fingerprint = createHash("sha256").update(JSON.stringify([input.taskId,input.version,input.answer])).digest("hex");
  const ref = access.db.doc(`preparationAttempts/${access.target}_${input.attemptId}`);
  return access.db.runTransaction(async transaction => {
    const existing = await transaction.get(ref);
    if (existing.exists) {
      if (existing.get("fingerprint") !== fingerprint) throw new Error("409");
      return { saved: true, attemptId: input.attemptId };
    }
    const submittedAt=new Date().toISOString();
    transaction.set(access.db.doc(`preparationSummaries/${access.target}`),{lastActivity:submittedAt},{merge:true});
    transaction.create(ref, { id: input.attemptId, studentId: access.target, taskId: task.id, taskVersion: task.version,
      submittedAt, sourceType: task.origin, examYear: task.examYear, startedAt: null, awardedPoints: null, maxPoints: null, evaluationStatus: checked.correct === null ? "pending" : "evaluated",
      correct: checked.correct, answer: input.answer, source: "server", checkingMethod: "published-trainer-v1", fingerprint });
    return { saved: true, attemptId: input.attemptId };
  });
}
