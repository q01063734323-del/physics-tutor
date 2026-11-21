import { timingSafeEqual } from 'node:crypto';
import { getFirebaseAdmin } from '@/lib/firebase-admin';
import { dispatchPush } from '@/lib/push/server';
import { fail, reply } from '@/lib/push/http';
export async function POST(request: Request) {
  const expected = process.env.PUSH_CRON_SECRET || '', actual = request.headers.get('authorization')?.replace(/^Bearer /, '') || '';
  const expectedBytes = Buffer.from(expected), actualBytes = Buffer.from(actual);
  if (expected.length < 32 || actualBytes.length !== expectedBytes.length || !timingSafeEqual(actualBytes, expectedBytes)) return reply({ error: 'Unauthorized' }, 401);
  try { return reply(await dispatchPush(getFirebaseAdmin().adminDb)); } catch (error) { return fail(error); }
}
