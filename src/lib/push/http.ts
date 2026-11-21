import { trainerOriginAllowed } from '../trainer-public';
export class PushError extends Error { constructor(message: string, readonly status = 400) { super(message); } }
export const privateHeaders = { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' };
export const reply = (body: object, status = 200) => Response.json(body, { status, headers: privateHeaders });
export function fail(error: unknown) {
  const status = error instanceof PushError ? error.status : error instanceof Error && ['400', '401', '403', '404'].includes(error.message) ? Number(error.message) : 503;
  return reply({ error: error instanceof PushError ? error.message : status === 401 ? 'Войдите в аккаунт.' : status === 403 ? 'Нет доступа.' : 'Операция не выполнена. Повторите попытку.' }, status);
}
export async function input(request: Request): Promise<Record<string, unknown>> {
  if (request.headers.get('sec-fetch-site') === 'cross-site' || !trainerOriginAllowed(request.headers.get('origin'), request.url, process.env.NEXT_PUBLIC_SITE_URL || 'https://physics-tutor-6ytz.onrender.com')) throw new PushError('Запрос отклонён.', 403);
  const reader = request.body?.getReader(); if (!reader) throw new PushError('Нет данных.');
  const chunks: Uint8Array[] = []; let size = 0;
  for (;;) { const next = await reader.read(); if (next.done) break; size += next.value.byteLength; if (size > 32_768) { await reader.cancel(); throw new PushError('Слишком большой запрос.', 413); } chunks.push(next.value); }
  try { const value = JSON.parse(Buffer.concat(chunks).toString()); if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error(); return value; } catch { throw new PushError('Некорректный запрос.'); }
}
