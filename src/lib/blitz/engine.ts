import { catalogVersion, formulaById, sections } from "./catalog";
import { filterQuestions, questionById, shuffle, type Settings } from "./questions";

export type Review = { id: string; sessionId: string; questionId: string; learningId: string; correct: boolean; selected: string; at: string; selfRated: boolean };
export type Mastery = { attempts: number; errors: number; correct: number; percent: number; streak: number; level: number; lastSeen: string; nextDue: string };
export type Session = { id: string; catalogVersion: string; settings: Settings; questionIds: string[]; seed: number; index: number; startedAt: string; deadlineAt: number | null; reviews: Review[] };
export type Result = { id: string; kind: "formula-blitz-v2"; mode: Settings["mode"]; reviews: Review[]; total: number; correct: number; duration: number; startedAt: string; finishedAt: string };
export type StudyState = { schemaVersion: 2; events: Review[]; history: Result[]; pending: Result[]; syncedIds: string[]; active: Session | null };
export const emptyStudyState = (): StudyState => ({ schemaVersion: 2, events: [], history: [], pending: [], syncedIds: [], active: null });

const day = 86400000;
const intervals = [10 / 1440, 1, 3, 7, 14, 30, 60];
export function masteryFor(events: Review[]): Record<string, Mastery> {
  const states: Record<string, Mastery> = {};
  const seen = new Set<string>();
  for (const event of [...events].sort((a, b) => a.at.localeCompare(b.at) || a.id.localeCompare(b.id))) {
    if (seen.has(event.id)) continue; seen.add(event.id);
    const old = states[event.learningId] || { attempts: 0, errors: 0, correct: 0, percent: 0, streak: 0, level: 0, lastSeen: "", nextDue: "" };
    const attempts = old.attempts + 1, correct = old.correct + Number(event.correct);
    const streak = event.correct ? old.streak + 1 : 0;
    const level = event.correct ? Math.min(6, old.level + 1) : 0;
    states[event.learningId] = { attempts, errors: attempts - correct, correct, percent: Math.round(100 * correct / attempts), streak, level,
      lastSeen: event.at, nextDue: new Date(Date.parse(event.at) + intervals[level] * day).toISOString() };
  }
  return states;
}

export function mistakeIds(events: Review[]): string[] {
  const latest = new Map<string, Review>();
  for (const review of events) if (!latest.has(review.questionId) || latest.get(review.questionId)!.at <= review.at) latest.set(review.questionId, review);
  return [...latest.values()].filter(review => !review.correct).map(review => review.questionId);
}

export function createSession(state: StudyState, settings: Settings, now: number, seed: number, id: string): Session {
  const pool = filterQuestions(settings, mistakeIds(state.events));
  const shuffled = shuffle(pool, seed);
  let ordered = shuffled;
  if (settings.mode === "exam") {
    const selected = new Set<string>(); ordered = [];
    const areas = shuffle(sections.filter(section => pool.some(q => q.sections.includes(section))), seed + 1);
    let found = true;
    while (found) {
      found = false;
      for (const area of areas) {
        const next = shuffled.find(q => q.sections.includes(area) && !selected.has(q.id));
        if (next) { selected.add(next.id); ordered.push(next); found = true; }
      }
    }
    ordered.push(...shuffled.filter(q => !selected.has(q.id)));
  } else {
    const mastery = masteryFor(state.events);
    const priority = (id: string) => { const m = mastery[id]; return !m ? 30 : (Date.parse(m.nextDue) <= now ? 50 : 0) + Math.min(m.errors, 15) - m.level; };
    ordered = shuffled.sort((a, b) => priority(b.learningId) - priority(a.learningId));
  }
  const count = settings.count === "all" ? ordered.length : Math.min(settings.count, ordered.length);
  return { id, catalogVersion, settings, questionIds: ordered.slice(0, count).map(q => q.id), seed, index: 0,
    startedAt: new Date(now).toISOString(), deadlineAt: settings.mode === "timed" ? now + 90000 : null, reviews: [] };
}

export function answerSession(state: StudyState, selected: string, now: number, selfRated?: boolean): StudyState {
  const session = state.active;
  if (!session || session.catalogVersion !== catalogVersion || session.deadlineAt !== null && now >= session.deadlineAt) return state;
  const question = questionById.get(session.questionIds[session.index]);
  if (!question || session.reviews.some(review => review.questionId === question.id)) return state;
  if (selfRated !== undefined && session.settings.mode !== "flash") return state;
  if (selfRated === undefined && !question.choices.includes(selected)) return state;
  const review: Review = { id: `${session.id}:${question.id}`, sessionId: session.id, questionId: question.id, learningId: question.learningId,
    correct: selfRated ?? selected === question.correct, selected, at: new Date(now).toISOString(), selfRated: selfRated !== undefined };
  return { ...state, events: [...state.events, review], active: { ...session, reviews: [...session.reviews, review] } };
}

export function finishSession(state: StudyState, now: number): StudyState {
  const active = state.active;
  if (!active) return state;
  const finishedAt = active.deadlineAt === null ? now : Math.min(now, active.deadlineAt);
  const result: Result = { id: active.id, kind: "formula-blitz-v2", mode: active.settings.mode, reviews: active.reviews,
    total: active.questionIds.length, correct: active.reviews.filter(review => review.correct).length,
    duration: Math.max(0, Math.round((finishedAt - Date.parse(active.startedAt)) / 1000)), startedAt: active.startedAt, finishedAt: new Date(finishedAt).toISOString() };
  if (state.history.some(item => item.id === result.id)) return { ...state, active: null };
  return { ...state, active: null, history: [result, ...state.history], pending: [...state.pending, result] };
}

export function nextQuestion(state: StudyState, now: number): StudyState {
  const active = state.active;
  if (!active) return state;
  if (active.deadlineAt !== null && now >= active.deadlineAt) return finishSession(state, now);
  if (!active.reviews.some(review => review.questionId === active.questionIds[active.index])) return state;
  if (active.index >= active.questionIds.length - 1) return finishSession(state, now);
  return { ...state, active: { ...active, index: active.index + 1 } };
}

export function mergeCloudResults(state: StudyState, remote: Result[]): StudyState {
  const history = new Map(state.history.map(result => [result.id, result]));
  const events = new Map(state.events.map(review => [review.id, review]));
  const synced = new Set(state.syncedIds);
  for (const result of remote) {
    if (result.kind !== "formula-blitz-v2" || !Array.isArray(result.reviews)) continue;
    history.set(result.id, result); synced.add(result.id);
    for (const review of result.reviews) if (review && typeof review.id === "string" && typeof review.correct === "boolean" && Number.isFinite(Date.parse(review.at)) && questionById.has(review.questionId)) events.set(review.id, review);
  }
  return { ...state, history: [...history.values()].sort((a, b) => b.finishedAt.localeCompare(a.finishedAt)), events: [...events.values()], syncedIds: [...synced], pending: state.pending.filter(result => !synced.has(result.id)) };
}

export function dayStreak(events: Review[], now: number): number {
  const localDay = (date: Date) => `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
  const days = new Set(events.map(event => localDay(new Date(event.at))));
  const date = new Date(now); let count = 0;
  if (!days.has(localDay(date))) date.setDate(date.getDate() - 1);
  while (days.has(localDay(date))) { count++; date.setDate(date.getDate() - 1); }
  return count;
}

export function weakFormulas(events: Review[], now: number) {
  return Object.entries(masteryFor(events)).filter(([id, m]) => id.startsWith("formula:") && (m.percent < 80 || Date.parse(m.nextDue) <= now))
    .map(([id, mastery]) => ({ formula: formulaById.get(id.slice(8)), mastery })).filter(item => item.formula)
    .sort((a, b) => a.mastery.percent - b.mastery.percent || b.mastery.errors - a.mastery.errors);
}
