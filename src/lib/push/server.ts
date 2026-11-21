import 'server-only';
import { createHash, randomBytes, ECDH, createECDH } from 'node:crypto';
import { FieldValue, type Firestore, type Transaction } from 'firebase-admin/firestore';
import * as webpush from 'web-push';
import { DAY, cancelled, dueTime, notificationPayload, reminderAllowed, safePushEndpoint, type PushKind } from './policy';
import { PushError } from './http';
export const digest = (value: string) => createHash('sha256').update(value).digest('hex');
export type PushJob = { kind: PushKind | 'test'; assignmentId: string; recipients: string[]; createdAt: number; availableAt: number; expectedDue?: number; submissionId?: string; revision?: number; deviceId?: string; recipientCursor?: number; retryPending?: boolean };
type Subscription = { userId: string; deviceId: string; binding: string; endpoint: string; keys: { p256dh: string; auth: string }; active: boolean; createdAt: number; lastTestAt?: number };
export function pushConfig() {
  const publicKey = process.env.WEB_PUSH_PUBLIC_KEY || '', privateKey = process.env.WEB_PUSH_PRIVATE_KEY || '', subject = process.env.WEB_PUSH_SUBJECT || '';
  let keyPairValid = false;
  try { const ec = createECDH('prime256v1'); ec.setPrivateKey(Buffer.from(privateKey, 'base64url')); keyPairValid = /^[A-Za-z0-9_-]{43}$/.test(privateKey) && ec.getPublicKey().toString('base64url') === publicKey; } catch { /* missing or invalid configuration */ }
  return { enabled: process.env.WEB_PUSH_ENABLED === 'true' && keyPairValid && /^(mailto:[^\s@]+@[^\s@]+|https:\/\/[^\s]+)$/.test(subject), publicKey, privateKey, subject };
}
export function subscriptionInput(value: unknown) {
  const s = value as { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } };
  if (!s || !safePushEndpoint(s.endpoint) || typeof s.keys?.p256dh !== 'string' || typeof s.keys.auth !== 'string' || !/^[A-Za-z0-9_-]{87}$/.test(s.keys.p256dh) || !/^[A-Za-z0-9_-]{22}$/.test(s.keys.auth) || Buffer.from(s.keys.p256dh, 'base64url')[0] !== 4) throw new PushError('Некорректная подписка устройства.');
  try { ECDH.convertKey(Buffer.from(s.keys.p256dh, 'base64url'), 'prime256v1'); } catch { throw new PushError('Некорректный ключ устройства.'); }
  return { endpoint: s.endpoint, keys: { p256dh: s.keys.p256dh, auth: s.keys.auth } };
}
export function createJob(tx: Transaction, db: Firestore, key: string, job: PushJob) { tx.set(db.doc(`pushJobs/${digest(key)}`), job); }
export function assignmentJobs(tx: Transaction, db: Firestore, id: string, recipients: string[], assignment: { dueDate?: unknown }, now: number, isNew: boolean) {
  if (isNew) createJob(tx, db, `assigned:${id}`, { kind: 'assigned', assignmentId: id, recipients, createdAt: now, availableAt: now });
  const due = dueTime(assignment.dueDate);
  if (due && due - now >= DAY) createJob(tx, db, `deadline:${id}:${due}`, { kind: 'deadline', assignmentId: id, recipients, expectedDue: due, createdAt: now, availableAt: due - DAY });
}
export async function bindSubscription(db: Firestore, uid: string, deviceId: string, raw: unknown) {
  const config = pushConfig(); if (!config.enabled) throw new PushError('Уведомления ещё не настроены преподавателем.', 503);
  const data = subscriptionInput(raw), id = digest(data.endpoint), binding = randomBytes(24).toString('base64url');
  await db.runTransaction(async tx => {
    const devices = await tx.get(db.collection('pushSubscriptions').where('userId', '==', uid));
    if (devices.docs.filter(d => d.id !== id && d.get('active')).length >= 20) throw new PushError('Подключено слишком много устройств. Отключите одно из старых.', 409);
    for (const old of devices.docs) if (old.id !== id && old.get('deviceId') === deviceId) tx.delete(old.ref);
    tx.set(db.doc(`pushSubscriptions/${id}`), { ...data, userId: uid, deviceId, binding, active: true, createdAt: Date.now() });
  });
  return { id, binding };
}
export async function unbindSubscription(db: Firestore, uid: string, id: string, deviceId: string) {
  await db.runTransaction(async tx => { const ref = db.doc(`pushSubscriptions/${id}`), row = await tx.get(ref); if (row.get('userId') === uid && row.get('deviceId') === deviceId) tx.delete(ref); });
}
export async function queueTest(db: Firestore, uid: string, id: string, deviceId: string) {
  if (!pushConfig().enabled) throw new PushError('Отправка уведомлений выключена преподавателем.', 503);
  const now = Date.now();
  await db.runTransaction(async tx => {
    const ref = db.doc(`pushSubscriptions/${id}`), row = await tx.get(ref);
    if (row.get('userId') !== uid || row.get('deviceId') !== deviceId || !row.get('active')) throw new PushError('Сначала включите уведомления на этом устройстве.', 409);
    if (now - (row.get('lastTestAt') || 0) < 60_000) throw new PushError('Повторить тест можно через минуту.', 429);
    tx.update(ref, { lastTestAt: now });
    createJob(tx, db, `test:${id}:${now}`, { kind: 'test', assignmentId: '', deviceId, recipients: [uid], availableAt: now, createdAt: now });
  });
}
function millis(value: unknown): number { return typeof value === 'number' ? value : value && typeof value === 'object' && 'toMillis' in value && typeof value.toMillis === 'function' ? Number(value.toMillis()) : 0; }
async function validRecipient(db: Firestore, job: PushJob, uid: string, now: number) {
  const user = await db.doc(`users/${uid}`).get();
  if (user.get('role') !== 'student' || user.get('status') !== 'active') return false;
  if (job.kind === 'test') return true;
  const assignment = await db.doc(`assignments/${job.assignmentId}`).get(), a = assignment.data();
  if (!a || cancelled(a.status) || (a.audience !== 'class' && a.assignedToId !== uid)) return false;
  const links = await db.collection('teacherStudents').where('teacherId', '==', a.teacherId).get();
  if (!links.docs.some(d => d.get('studentId') === uid && [undefined, 'active'].includes(d.get('status')))) return false;
  if (job.kind === 'deadline') {
    const works = await db.collection('submissions').where('assignmentId', '==', job.assignmentId).get();
    const latest = works.docs.filter(d => d.get('userId') === uid || d.get('user') === user.get('email')).sort((a, b) => millis(b.get('createdAt')) - millis(a.get('createdAt')))[0];
    return reminderAllowed(a, job.expectedDue!, now, latest?.get('status'));
  }
  if (job.kind === 'reviewed') {
    const work = await db.doc(`submissions/${job.submissionId}`).get();
    return work.get('userId') === uid && work.get('reviewRevision') === job.revision && ['Проверено', 'Возвращено на доработку', 'reviewed', 'returned'].includes(work.get('status'));
  }
  return true;
}
export type PushTransport = (subscription: { endpoint: string; keys: { p256dh: string; auth: string } }, payload: string, topic: string) => Promise<unknown>;
const transport: PushTransport = async (sub, payload, topic) => {
  const c = pushConfig(); return webpush.sendNotification(sub, payload, { vapidDetails: { subject: c.subject, publicKey: c.publicKey, privateKey: c.privateKey }, TTL: 3600, urgency: 'normal', topic, timeout: 10_000 });
};
/** Persistent per-device reservation is never retried after an ambiguous network result.
 * Web Push has no exactly-once acknowledgement; sacrificing uncertain delivery avoids duplicates. */
export async function dispatchPush(db: Firestore, send: PushTransport = transport, budgetMs = 40_000) {
  if (!pushConfig().enabled) return { enabled: false, accepted: 0, uncertain: 0 };
  const started = Date.now(), lockRef = db.doc('pushControl/dispatcher'), owner = randomBytes(12).toString('hex');
  const locked = await db.runTransaction(async tx => { const lock = await tx.get(lockRef); if ((lock.get('until') || 0) > Date.now()) return false; tx.set(lockRef, { owner, until: Date.now() + 90_000 }); return true; });
  if (!locked) return { busy: true, accepted: 0, uncertain: 0 };
  let accepted = 0, uncertain = 0;
  try {
    const jobs = await db.collection('pushJobs').where('availableAt', '<=', Date.now()).orderBy('availableAt').limit(25).get();
    outer: for (const row of jobs.docs) {
      const job = row.data() as PushJob; let pending = Boolean(job.retryPending);
      for (let index = job.recipientCursor || 0; index < job.recipients.length; index++) {
        const uid = job.recipients[index];
        if (Date.now() - started > budgetMs) break outer;
        if (!await validRecipient(db, job, uid, Date.now())) { await row.ref.update({ recipientCursor: index + 1 }); continue; }
        const devices = await db.collection('pushSubscriptions').where('userId', '==', uid).get();
        for (const device of devices.docs) {
          if (Date.now() - started > budgetMs) break outer;
          const sub = device.data() as Subscription;
          if (!sub.active || (job.deviceId && job.deviceId !== sub.deviceId)) continue;
          const delivery = db.doc(`pushDeliveries/${digest(row.id + device.id + sub.binding)}`);
          const reserved = await db.runTransaction(async tx => {
            const previous = await tx.get(delivery), current = await tx.get(device.ref);
            if (!current.exists || current.get('binding') !== sub.binding || current.get('userId') !== uid || !current.get('active')) return false;
            if (previous.exists && (previous.get('status') !== 'retry' || previous.get('retryAt') > Date.now())) { if (previous.get('status') === 'retry') pending = true; return false; }
            tx.set(delivery, { eventId: row.id, subscriptionId: device.id, userId: uid, status: 'sending', reservedAt: Date.now() }); return true;
          });
          if (!reserved) { if (pending) await row.ref.update({ retryPending: true }); continue; }
          // Recheck current source/status and binding immediately before external I/O.
          const current = await device.ref.get();
          if (!current.exists || current.get('binding') !== sub.binding || !await validRecipient(db, job, uid, Date.now())) { await delivery.update({ status: 'cancelled' }); continue; }
          const payload = job.kind === 'test' ? { title: 'Физика с Егором', body: 'Уведомления на этом устройстве работают', url: '/student?notifications=1', eventId: row.id, binding: sub.binding } : notificationPayload(job.kind, job.assignmentId, row.id, sub.binding);
          try { await send(sub, JSON.stringify(payload), digest(row.id).slice(0, 32)); await delivery.update({ status: 'accepted', acceptedAt: Date.now() }); accepted++; }
          catch (error) {
            const code = Number((error as { statusCode?: number }).statusCode);
            if (code === 404 || code === 410) {
              await db.runTransaction(async tx => { const latest = await tx.get(device.ref); if (latest.get('binding') === sub.binding) tx.delete(device.ref); });
              await delivery.update({ status: 'expired' });
            } else if (code === 429) { pending = true; await row.ref.update({ retryPending: true }); await delivery.update({ status: 'retry', retryAt: Date.now() + 300_000 }); }
            else { uncertain++; await delivery.update({ status: 'uncertain', failedAt: Date.now() }); }
          }
        }
        await row.ref.update({ recipientCursor: index + 1 });
      }
      await row.ref.update({ recipientCursor: 0, retryPending: false, state: pending ? 'pending' : 'done', availableAt: pending ? Date.now() + 300_000 : FieldValue.delete(), completedAt: pending ? null : Date.now() });
    }
    return { enabled: true, accepted, uncertain };
  } finally { await db.runTransaction(async tx => { const lock = await tx.get(lockRef); if (lock.get('owner') === owner) tx.delete(lockRef); }); }
}
