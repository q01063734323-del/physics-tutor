export type DashboardAssignment = { title: string; dueDate?: string | null; due?: string; assignedTo?: string };
export type DashboardSubmission = { assignment?: string; user?: string; status?: string; score?: string | number; createdAt?: unknown };

export function isOverdue(assignment: DashboardAssignment, now?: Date): boolean {
  if (!now) return false;
  if (!assignment.dueDate) return false;
  const deadline = new Date(`${assignment.dueDate}T23:59:59`);
  return !Number.isNaN(deadline.getTime()) && deadline.getTime() < now.getTime();
}

export function submissionStats(assignments: DashboardAssignment[], submissions: DashboardSubmission[], now?: Date) {
  const sent = new Set(submissions.map(item => item.assignment).filter(Boolean));
  const reviewed = new Set(submissions.filter(item => item.status === "Проверено").map(item => item.assignment).filter(Boolean));
  const pending = new Set(submissions.filter(item => item.status === "На проверке" || item.status === "Отправлено").map(item => item.assignment).filter(Boolean));
  return {
    assigned: assignments.length,
    sent: sent.size,
    reviewed: reviewed.size,
    pending: pending.size,
    overdue: assignments.filter(item => isOverdue(item, now) && !reviewed.has(item.title)).length,
  };
}

export function learningStreak(submissions: DashboardSubmission[], now?: Date): number {
  if (!now) return 0;
  const days = new Set(submissions.map(item => {
    if (!item.createdAt) return "";
    const value = item.createdAt as { toDate?: () => Date } | string | Date;
    const date = typeof value === "object" && "toDate" in value && value.toDate ? value.toDate() : new Date(value as string | Date);
    return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
  }).filter(Boolean));
  let streak = 0;
  const cursor = new Date(now);
  cursor.setHours(12, 0, 0, 0);
  while (days.has(cursor.toISOString().slice(0, 10))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

