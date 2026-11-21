import { after } from 'next/server';
import { preparationAccess } from '@/lib/command-center/access';
import { mutateHomework, readHomework } from '@/lib/push/homework';
import { dispatchPush } from '@/lib/push/server';
import { validId } from '@/lib/push/policy';
import { fail, input, PushError, reply } from '@/lib/push/http';
export async function GET(request: Request) {
  try { const actor = await preparationAccess(request), id = new URL(request.url).searchParams.get('assignment'); if (!validId(id)) throw new PushError('Нет задания.'); return reply(await readHomework(actor, id)); } catch (error) { return fail(error); }
}
export async function POST(request: Request) {
  try { const actor = await preparationAccess(request), body = await input(request), result = await mutateHomework(actor, body);
    after(async () => { try { await dispatchPush(actor.db, undefined, 8_000); } catch { /* The committed outbox is retried by the external scheduler. */ } });
    return reply(result);
  } catch (error) { return fail(error); }
}
