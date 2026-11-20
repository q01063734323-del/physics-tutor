export type TaskMeta = { id: string; version: string; section: string; topics: string[]; examNumber: number | null };
export type LearningAttempt = { id: string; taskId: string; taskVersion: string; submittedAt: string; evaluationStatus: "evaluated" | "pending" | "cancelled" | "error"; correct: boolean | null; answer: string; source: "server" | "local"; teacherErrorClass?: string; reviewAnswer?: string | null };
export type PreparationProfile = { examYear: number; targetScore: number | null; examDate: string | null; dateSource: "teacher" | "student" | null };
export function validTarget(value: unknown): value is number { return typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 100; }
export function summarizeAttempts(tasks: TaskMeta[], attempts: LearningAttempt[], since = 0, until = Date.now()) {
  const catalog = new Map(tasks.map(task => [task.id, task]));
  const unique = new Map<string, LearningAttempt>();
  for (const attempt of attempts) {
    const task = catalog.get(attempt.taskId), time = Date.parse(attempt.submittedAt);
    if (!task || task.version !== attempt.taskVersion || !Number.isFinite(time) || time > until || attempt.evaluationStatus !== "evaluated" || typeof attempt.correct !== "boolean") continue;
    if (!unique.has(attempt.id)) unique.set(attempt.id, attempt);
  }
  const history = [...unique.values()].sort((a,b) => a.submittedAt.localeCompare(b.submittedAt));
  const valid = history.filter(attempt => Date.parse(attempt.submittedAt) >= since);
  const attempted = new Set(valid.map(item => item.taskId));
  const solved = new Set(valid.filter(item => item.correct).map(item => item.taskId));
  const first = new Map<string, LearningAttempt>();
  // Use the genuine first recorded answer, even when a later retry falls into the selected period.
  for (const attempt of history) if (attempted.has(attempt.taskId) && !first.has(attempt.taskId)) first.set(attempt.taskId, attempt);
  const accuracy = valid.length ? 100 * valid.filter(item => item.correct).length / valid.length : null;
  const firstAccuracy = first.size ? 100 * [...first.values()].filter(item => item.correct).length / first.size : null;
  return { attempts: valid, attemptsCount: valid.length, uniqueAttempted: attempted.size, uniqueSolved: solved.size, accuracy, firstAccuracy,
    coverage: tasks.length ? 100 * attempted.size / tasks.length : null,
    mastery: first.size < 10 ? "insufficient" : firstAccuracy! >= 80 ? "stable" : firstAccuracy! >= 50 ? "developing" : "needs-practice",
    lastActivity: valid.at(-1)?.submittedAt || null };
}
export function topicAnalytics(tasks: TaskMeta[], attempts: LearningAttempt[], since = 0, until = Date.now()) {
  return [...new Set(tasks.flatMap(task => task.topics))].map(topic => {
    const relevant = tasks.filter(task => task.topics.includes(topic));
    return { topic, available: relevant.length, ...summarizeAttempts(relevant, attempts, since, until) };
  });
}
export function numberAnalytics(tasks: TaskMeta[], attempts: LearningAttempt[], since = 0, until = Date.now()) {
  return [...new Set(tasks.map(task => task.examNumber).filter((number): number is number => number !== null))].sort((a,b)=>a-b).map(number => {
    const relevant = tasks.filter(task => task.examNumber === number);
    return { number, available: relevant.length, ...summarizeAttempts(relevant, attempts, since, until) };
  });
}

export function studyDay(timestamp: string) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Moscow", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(timestamp));
}
export function validPreparationProfile(value: unknown): value is { targetScore: number; examYear: number; examDate: string | null } {
  if (!value || typeof value !== "object") return false;
  const data = value as Record<string, unknown>;
  if (!validTarget(data.targetScore) || typeof data.examYear !== "number" || !Number.isInteger(data.examYear) || data.examYear < 2026 || data.examYear > 2040) return false;
  if (data.examDate === null) return true;
  if (typeof data.examDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(data.examDate) || Number(data.examDate.slice(0,4)) !== data.examYear) return false;
  const date = new Date(data.examDate + "T00:00:00Z");
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0,10) === data.examDate;
}
export function preparationRecommendations(tasks: TaskMeta[], attempts: LearningAttempt[], priorities: string[] = [], now = Date.now(), homeworkTopics: string[] = [], examDate?: string | null) {
  const topics = topicAnalytics(tasks, attempts, 0, now);
  const nearExam = examDate && Date.parse(examDate + "T00:00:00+03:00") - now < 30 * 86400000 && Date.parse(examDate + "T00:00:00+03:00") >= now;
  return topics.filter(topic => topic.available > 0).map(topic => {
    const reasons: string[] = []; let priority = 0;
    if (priorities.includes(topic.topic)) { priority += 100; reasons.push("Тема выбрана преподавателем как приоритетная."); }
    const mistakes = topic.attemptsCount - topic.attempts.filter(attempt => attempt.correct).length;
    if (mistakes) { priority += Math.min(30, mistakes * 5); reasons.push(`В проверенных попытках по теме ${mistakes} неверных ответов.`); }
    if (topic.uniqueAttempted < 5) { priority += 10; reasons.push(`Пока опробовано ${topic.uniqueAttempted} уникальных задач: нужно расширить выборку.`); }
    if (topic.lastActivity && now - Date.parse(topic.lastActivity) > 14 * 86400000) { priority += 15; reasons.push("Подтверждённой практики по теме не было более 14 дней."); }
    if (homeworkTopics.some(item => item === topic.topic || tasks.some(task => task.topics.includes(topic.topic) && task.section === item))) { priority += 35; reasons.push("Тема связана с назначенным домашним заданием."); }
    if (nearExam && mistakes) { priority += 10; reasons.push("До заданной даты экзамена менее 30 дней."); }
    return { topic: topic.topic, priority, reasons, count: Math.min(5, topic.available) };
  }).filter(item => item.reasons.length).sort((a,b) => b.priority-a.priority || a.topic.localeCompare(b.topic,"ru")).slice(0,5);
}

export type ExamObservation = { id:string; examYear:number; variant:string; status:"pending"|"reviewed"; primaryScore:number; maxPrimary:number; testScore:number|null; completedAt:string; gradingSource:string; fullFormat:true; recordedBy:string };
export function observedExamRange(exams:ExamObservation[],year:number) {
  const results=exams.filter(exam=>exam.examYear===year && exam.status==="reviewed" && exam.fullFormat && exam.gradingSource.trim() && Number.isInteger(exam.testScore) && exam.testScore!>=0 && exam.testScore!<=100).sort((a,b)=>a.completedAt.localeCompare(b.completedAt));
  return {count:results.length,last:results.at(-1)||null,range:results.length>=2?[Math.min(...results.map(exam=>exam.testScore!)),Math.max(...results.map(exam=>exam.testScore!))]:null,forecast:null,reason:"Показаны наблюдавшиеся результаты, а не прогноз. Статистическая модель не валидирована."};
}
