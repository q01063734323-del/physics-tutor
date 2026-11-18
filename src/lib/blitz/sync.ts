import type { User } from "firebase/auth";
import { doc, getDoc, getDocs, query, collection, serverTimestamp, setDoc, where } from "firebase/firestore";
import { db } from "../firebase";
import type { Result } from "./engine";
import { readLocalRecord, writeLocalRecord } from "./storage";

export function canSyncLearning(account: string, user: { uid: string; email: string | null } | null, demo: boolean) {
  return !demo && Boolean(user?.email) && account === user?.uid;
}

export type LearningTransport = { read: () => Promise<Result[]>; send: (result: Result) => Promise<void> };
export async function flushLearningResults(pending: Result[], eligible: boolean, transport: LearningTransport) {
  if (!eligible) return { acknowledged: [] as Result[], failed: [] as string[], remote: [] as Result[] };
  const failed: string[] = [];
  let remote: Result[] = [];
  try { remote = await transport.read(); } catch { failed.push("read"); }
  const acknowledged: Result[] = [];
  const known = new Set(remote.map(result => result.id));
  for (const result of pending) {
    if (known.has(result.id)) continue;
    try { await transport.send(result); acknowledged.push(result); known.add(result.id); } catch { failed.push(result.id); }
  }
  return { acknowledged, failed, remote };
}

async function sendOwnedResult(user: User, id: string, result: Record<string, unknown>) {
  const reference = doc(db, "examAttempts", id);
  const data = { ...result, user: user.email, userId: user.uid, createdAt: serverTimestamp() };
  try { await setDoc(reference, data); }
  catch (error) {
    // Students cannot read a nonexistent document under the current rules.
    // Create first; on a retry, verify an already-created result instead of updating it.
    const existing = await getDoc(reference).catch(() => null);
    const stored = existing?.data();
    if (!existing?.exists() || stored?.userId !== user.uid || stored?.user !== user.email || stored?.kind !== result.kind || stored?.total !== result.total || stored?.score !== result.score) throw error;
  }
}

export function firebaseLearningTransport(user: User): LearningTransport {
  return {
    async read() {
      const snapshot = await getDocs(query(collection(db, "examAttempts"), where("user", "==", user.email)));
      return snapshot.docs.map(document => document.data()).filter(data => data.kind === "formula-blitz-v2") as Result[];
    },
    async send(result) { await sendOwnedResult(user, result.id, { ...result, score: result.correct }); },
  };
}

export type LocalExamResult = { id: string; kind: "exam-v2"; score: number; total: number; mode: string; answers: Record<number, string>; finishedAt: string; synced?: boolean };
let examWrites = Promise.resolve();
export function queueExamResult(account: string, result: LocalExamResult): Promise<void> {
  const next = examWrites.catch(() => undefined).then(async () => {
    const key = `exam-outbox:${account}`;
    const records = await readLocalRecord<LocalExamResult[]>(key, []);
    if (!records.some(record => record.id === result.id)) await writeLocalRecord(key, [...records, result]);
  });
  examWrites = next; return next;
}

export async function syncExamResults(account: string, user: User | null, demo: boolean) {
  if (!canSyncLearning(account, user, demo) || !user) return { pending: 0, local: true };
  await examWrites.catch(() => undefined);
  const key = `exam-outbox:${account}`;
  const records = await readLocalRecord<LocalExamResult[]>(key, []);
  const sent = new Set<string>();
  for (const result of records.filter(result => !result.synced)) {
    try { await sendOwnedResult(user, result.id, result); sent.add(result.id); } catch { /* Keep the durable result for the next retry. */ }
  }
  const next = examWrites.catch(() => undefined).then(async () => {
    const latest = await readLocalRecord<LocalExamResult[]>(key, []);
    await writeLocalRecord(key, latest.map(result => sent.has(result.id) ? { ...result, synced: true } : result));
  });
  examWrites = next; await next;
  const latest = await readLocalRecord<LocalExamResult[]>(key, []);
  return { pending: latest.filter(result => !result.synced).length, local: false };
}
