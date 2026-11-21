export type PushKind = 'assigned' | 'deadline' | 'reviewed';
export const DAY = 86_400_000;
export function validId(value: unknown): value is string { return typeof value === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(value); }
export function dueTime(value: unknown): number | null {
  if (typeof value !== 'string' || !value) return null;
  // Existing date-only homework deadlines mean the end of that day in Moscow.
  const text = /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T23:59:00+03:00` : value;
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{3})?)?(Z|[+-]\d{2}:\d{2})$/.test(text)) return null;
  const day = Date.parse(text.slice(0, 10) + 'T00:00:00Z');
  if (!Number.isFinite(day) || new Date(day).toISOString().slice(0, 10) !== text.slice(0, 10)) return null;
  const time = Date.parse(text); return Number.isFinite(time) ? time : null;
}
export const cancelled = (status: unknown) => ['cancelled', 'canceled', 'Отменено'].includes(String(status));
export const returned = (status: unknown) => ['returned', 'Возвращено на доработку'].includes(String(status));
export function reminderAllowed(assignment: { status?: unknown; dueDate?: unknown }, expectedDue: number, now: number, latestStatus?: unknown) {
  return !cancelled(assignment.status) && dueTime(assignment.dueDate) === expectedDue && now >= expectedDue - DAY && now < expectedDue &&
    !['submitted', 'reviewed', 'На проверке', 'Проверено', 'Отправлено'].includes(String(latestStatus ?? assignment.status));
}
export function notificationPayload(kind: PushKind, assignmentId: string, eventId: string, binding: string) {
  return { title: 'Физика с Егором', body: kind === 'assigned' ? 'Назначена домашняя работа' : kind === 'deadline' ? 'До срока домашней работы остались сутки' : 'Домашняя работа проверена',
    url: `/student?assignment=${encodeURIComponent(assignmentId)}`, eventId, binding };
}
export function safePushEndpoint(value: unknown): value is string {
  if (typeof value !== 'string' || value.length > 2048) return false;
  try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password && !url.port && !url.hash &&
    (['fcm.googleapis.com', 'android.googleapis.com', 'updates.push.services.mozilla.com'].includes(url.hostname) || url.hostname.endsWith('.push.apple.com') || url.hostname === 'web.push.apple.com' || url.hostname.endsWith('.notify.windows.com')); } catch { return false; }
}
