import type { User } from "firebase/auth";
import type { TrainerAttempt } from "../trainer-bank";
import { readLocalRecord, writeLocalRecord } from "../blitz/storage";
let writes = Promise.resolve();
function serial<T>(operation: () => Promise<T>): Promise<T> {
  const next = writes.catch(() => undefined).then(operation);
  writes = next.then(() => undefined, () => undefined); return next;
}
export function queuePreparationAttempt(account: string, attempt: TrainerAttempt) {
  return serial(async () => {
    const key = `preparation-outbox:${account}`;
    const records = await readLocalRecord<TrainerAttempt[]>(key, []);
    if (!records.some(record => record.id === attempt.id)) await writeLocalRecord(key, [...records, attempt]);
  });
}
export async function flushPreparationAttempts(account: string, user: User | null, demo: boolean) {
  if (demo || !user || account !== user.uid) return { pending: 0, localOnly: true };
  const pending = await serial(() => readLocalRecord<TrainerAttempt[]>(`preparation-outbox:${account}`, []));
  const acknowledged = new Set<string>();
  for (const attempt of pending) {
    // A sign-out or account switch must not send another identity's queue.
    const { auth } = await import("../firebase");
    if (auth.currentUser?.uid !== account) break;
    try {
      const token = await user.getIdToken();
      const response = await fetch("/api/preparation", { method: "POST", cache: "no-store", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ attemptId: attempt.id, taskId: attempt.questionId, version: attempt.version, answer: attempt.input }) });
      if (response.ok) acknowledged.add(attempt.id);
    } catch { break; }
  }
  return serial(async () => {
    const key = `preparation-outbox:${account}`;
    const latest = await readLocalRecord<TrainerAttempt[]>(key, []);
    const remaining = latest.filter(attempt => !acknowledged.has(attempt.id));
    await writeLocalRecord(key, remaining);
    if (acknowledged.size) window.dispatchEvent(new Event("physics-preparation-updated"));
    return { pending: remaining.length, localOnly: false };
  });
}
