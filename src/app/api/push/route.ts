import { after } from 'next/server';
import { preparationAccess } from '@/lib/command-center/access';
import { bindSubscription, dispatchPush, pushConfig, queueTest, unbindSubscription } from '@/lib/push/server';
import { fail, input, PushError, reply } from '@/lib/push/http';
export async function GET(request: Request) {
  try { await preparationAccess(request); const c = pushConfig(); return reply({ configured: c.enabled, publicKey: c.enabled ? c.publicKey : null }); } catch (error) { return fail(error); }
}
export async function POST(request: Request) {
  try {
    const actor = await preparationAccess(request); if (actor.teacher) throw new PushError('Уведомления предназначены для учеников.', 403);
    const body = await input(request), deviceId = body.deviceId;
    if (typeof deviceId !== 'string' || !/^[a-f0-9-]{36}$/.test(deviceId)) throw new PushError('Не определено устройство.');
    if (body.action === 'subscribe') return reply(await bindSubscription(actor.db, actor.user.uid, deviceId, body.subscription));
    if (typeof body.id !== 'string' || !/^[a-f0-9]{64}$/.test(body.id)) throw new PushError('Нет подписки.');
    if (body.action === 'status') { const s = await actor.db.doc(`pushSubscriptions/${body.id}`).get(); return reply({ active: s.get('userId') === actor.user.uid && s.get('deviceId') === deviceId && s.get('active') === true }); }
    if (body.action === 'unsubscribe') { await unbindSubscription(actor.db, actor.user.uid, body.id, deviceId); return reply({ removed: true }); }
    if (body.action === 'test') { await queueTest(actor.db, actor.user.uid, body.id, deviceId); after(async () => { try { await dispatchPush(actor.db, undefined, 8_000); } catch { /* persistent queue */ } }); return reply({ queued: true }); }
    throw new PushError('Неизвестная операция.');
  } catch (error) { return fail(error); }
}
