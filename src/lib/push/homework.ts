import 'server-only';
import { FieldValue, type Firestore } from 'firebase-admin/firestore';
import { validateUpload } from '../file-validation';
import { assignmentJobs, createJob, digest } from './server';
import { cancelled, dueTime, validId } from './policy';
import { PushError } from './http';
type Actor = { db: Firestore; user: { uid: string; email?: string }; teacher: boolean };
function text(value: unknown, max: number, fallback = '') { if (value === undefined) return fallback; if (typeof value !== 'string' || value.length > max) throw new PushError('Проверьте текст и длину полей.'); return value.trim(); }
async function students(actor: Actor) {
  const links = await actor.db.collection('teacherStudents').where('teacherId', '==', actor.user.uid).get();
  const ids = [...new Set(links.docs.filter(d => [undefined, 'active'].includes(d.get('status'))).map(d => d.get('studentId')).filter(validId))];
  if (ids.length > 1000) throw new PushError('В группе слишком много учеников для одной работы.', 413);
  const profiles = ids.length ? await actor.db.getAll(...ids.map(id => actor.db.doc(`users/${id}`))) : [];
  return profiles.filter(d => d.get('role') === 'student' && d.get('status') === 'active').map(d => ({ id: d.id, email: String(d.get('email') || '') }));
}
export async function canReadAssignment(actor: Actor, a: Record<string, unknown>) {
  if (actor.teacher) return a.teacherId === actor.user.uid;
  if (!validId(a.teacherId) || (a.audience !== 'class' && a.assignedToId !== actor.user.uid)) return false;
  const links = await actor.db.collection('teacherStudents').where('teacherId', '==', a.teacherId).get();
  return links.docs.some(d => d.get('studentId') === actor.user.uid && [undefined, 'active'].includes(d.get('status')));
}
export async function readHomework(actor: Actor, id: string) {
  const row = await actor.db.doc(`assignments/${id}`).get(), a = row.data();
  if (!a || !await canReadAssignment(actor, a)) throw new PushError('Работа недоступна этому аккаунту.', 404);
  const works = await actor.db.collection('submissions').where('assignmentId', '==', id).get();
  const serial = (v: unknown) => v && typeof v === 'object' && 'toDate' in v && typeof v.toDate === 'function' ? v.toDate().toISOString() : v;
  return { assignment: { ...a, id, createdAt: serial(a.createdAt), updatedAt: serial(a.updatedAt) }, submissions: works.docs.filter(d => actor.teacher || d.get('userId') === actor.user.uid || d.get('user') === actor.user.email).map(d => ({ ...d.data(), id: d.id, createdAt: serial(d.get('createdAt')), reviewedAt: serial(d.get('reviewedAt')) })) };
}
export async function mutateHomework(actor: Actor, body: Record<string, unknown>) {
  const db = actor.db, now = Date.now(), action = body.action;
  if (action === 'schedule-existing') {
    if (!actor.teacher) throw new PushError('Нет доступа.', 403);
    const roster = await students(actor), cursor = typeof body.cursor === 'string' && validId(body.cursor) ? body.cursor : '';
    const rows = (await db.collection('assignments').where('teacherId', '==', actor.user.uid).get()).docs.filter(d => d.id > cursor).sort((a,b) => a.id.localeCompare(b.id));
    let scheduled = 0;
    for (const item of rows.slice(0, 40)) {
      await db.runTransaction(async tx => {
        const row = await tx.get(item.ref), a = row.data(), state = await tx.get(db.doc(`pushAssignmentState/${item.id}`));
        const due = dueTime(a?.dueDate); if (!a || cancelled(a.status) || !due || due - now < 86_400_000) return;
        const job = await tx.get(db.doc(`pushJobs/${digest(`deadline:${item.id}:${due}`)}`)); if (job.exists) return;
        const recipients = state.get('recipients') || (validId(a.assignedToId) ? roster.filter(s => s.id === a.assignedToId).map(s => s.id) : a.audience === 'class' ? roster.map(s => s.id) : []);
        assignmentJobs(tx, db, item.id, recipients, a, now, false);
        if (!state.exists) tx.set(state.ref, { recipients }); scheduled++;
      });
    }
    return { scheduled, nextCursor: rows.length > 40 ? rows[39].id : null };
  }
  if (action === 'create') {
    if (!actor.teacher) throw new PushError('Только преподаватель может назначить работу.', 403);
    if (!validId(body.requestId)) throw new PushError('Не указан идентификатор операции.');
    const raw = body.assignment as Record<string, unknown>; if (!raw || typeof raw !== 'object') throw new PushError('Нет задания.');
    const roster = await students(actor);
    const recipients = raw.audience === 'class' ? roster : roster.filter(s => s.id === raw.assignedToId);
    if (raw.audience !== 'class' && !recipients.length) throw new PushError('Ученик не связан с этим преподавателем.', 403);
    const title = text(raw.title, 200); if (!title) throw new PushError('Укажите название.');
    const dueDate = raw.dueDate === null || raw.dueDate === undefined || raw.dueDate === '' ? null : text(raw.dueDate, 40);
    if (dueDate && !dueTime(dueDate)) throw new PushError('Проверьте срок сдачи.');
    const description = text(raw.description ?? raw.text, 12_000);
    const data = { title, text: description, description, topic: text(raw.topic, 200), level: text(raw.level, 40, 'school'), dueDate, due: dueDate ? `Сдать до ${dueDate}` : 'Без дедлайна',
      assignedTo: raw.audience === 'class' ? 'Все ученики' : recipients[0].email, assignedToId: raw.audience === 'class' ? null : recipients[0].id,
      audience: raw.audience === 'class' ? 'class' : 'student', teacherId: actor.user.uid, createdById: actor.user.uid, status: 'new',
      icon: '📄', tone: 'blue', time: text(raw.time, 30, '15 мин'), maxScore: Math.max(1, Math.min(1000, Number(raw.maxScore) || 10)), createdAt: FieldValue.serverTimestamp() };
    const ref = db.doc(`assignments/${digest(`assignment:${actor.user.uid}:${body.requestId}`)}`);
    await db.runTransaction(async tx => { const old = await tx.get(ref); if (old.exists) return; assignmentJobs(tx, db, ref.id, recipients.map(r => r.id), data, now, true); tx.create(ref, data); tx.create(db.doc(`pushAssignmentState/${ref.id}`), { recipients: recipients.map(r => r.id) }); });
    return { id: ref.id };
  }
  if (action === 'edit') {
    if (!actor.teacher) throw new PushError('Нет доступа.', 403);
    if (!validId(body.assignmentId)) throw new PushError('Нет задания.');
    const ref = db.doc(`assignments/${body.assignmentId}`), patch = body.patch as Record<string, unknown>;
    if (!patch || typeof patch !== 'object') throw new PushError('Нет изменений.');
    // Audience is immutable for this operation: editing cannot reissue a new-homework alert.
    const allowed: Record<string, unknown> = {};
    if ('title' in patch) { allowed.title = text(patch.title, 200); if (!allowed.title) throw new PushError('Укажите название.'); }
    if ('description' in patch) allowed.text = allowed.description = text(patch.description, 12_000);
    if ('dueDate' in patch) { const due = patch.dueDate ? text(patch.dueDate, 40) : null; if (due && !dueTime(due)) throw new PushError('Проверьте срок сдачи.'); allowed.dueDate = due; allowed.due = due ? `Сдать до ${due}` : 'Без дедлайна'; }
    if ('status' in patch) { if (!['new', 'cancelled'].includes(String(patch.status))) throw new PushError('Недопустимый статус.'); allowed.status = patch.status; }
    const roster = await students(actor);
    await db.runTransaction(async tx => {
      const row = await tx.get(ref), state = await tx.get(db.doc(`pushAssignmentState/${ref.id}`)), a = row.data(); if (!a || a.teacherId !== actor.user.uid) throw new PushError('Нет доступа к работе.', 403);
      if ('dueDate' in allowed && allowed.dueDate !== a.dueDate) assignmentJobs(tx, db, ref.id, state.get('recipients') || (validId(a.assignedToId) ? [a.assignedToId] : roster.map(s => s.id)), { dueDate: allowed.dueDate }, now, false);
      tx.update(ref, { ...allowed, updatedAt: FieldValue.serverTimestamp() });
    }); return { id: ref.id };
  }
  if (action === 'submit') {
    if (actor.teacher) throw new PushError('Для проверки выберите работу в профиле ученика.', 403);
    const raw = body.submission as Record<string, unknown>; if (!raw || !validId(raw.assignmentId) || !validId(body.requestId)) throw new PushError('Нет задания или идентификатора отправки.');
    const error = validateUpload({ name: String(raw.fileName || ''), type: String(raw.fileType || ''), size: Number(raw.fileSize) }); if (error) throw new PushError(error);
    const fileUrl = text(raw.fileUrl, 2048); let url; try { url = new URL(fileUrl); } catch { throw new PushError('Недопустимый файл.'); }
    if (url.protocol !== 'https:' || url.hostname !== 'res.cloudinary.com' || !url.pathname.startsWith('/y3gl6xsx/')) throw new PushError('Используйте загруженный файл решения.');
    const assignment = await db.doc(`assignments/${raw.assignmentId}`).get(), a = assignment.data();
    if (!a || !await canReadAssignment(actor, a) || cancelled(a.status)) throw new PushError('Работа недоступна.', 403);
    const ref = db.doc(`submissions/${digest(`submission:${actor.user.uid}:${body.requestId}`)}`);
    await db.runTransaction(async tx => {
      const old = await tx.get(ref), latest = await tx.get(assignment.ref); if (old.exists) return;
      if (cancelled(latest.get('status'))) throw new PushError('Работа отменена.', 409);
      tx.create(ref, { assignmentId: assignment.id, assignment: a.title, assignmentText: a.text || a.description || '', teacherId: a.teacherId,
        userId: actor.user.uid, user: actor.user.email, status: 'На проверке', score: '', comment: '', reviewedBy: null,
        fileUrl, fileName: text(raw.fileName, 250), fileType: text(raw.fileType, 150), fileSize: Number(raw.fileSize), createdAt: FieldValue.serverTimestamp() });
    }); return { id: ref.id };
  }
  if (action === 'review') {
    if (!actor.teacher) throw new PushError('Нет доступа.', 403);
    if (!validId(body.submissionId)) throw new PushError('Нет работы.');
    const ref = db.doc(`submissions/${body.submissionId}`), initial = await ref.get();
    const roster = await students(actor), student = roster.find(s => s.id === initial.get('userId') || s.email === initial.get('user'));
    if (!student || !validId(initial.get('assignmentId'))) throw new PushError('Ученик или задание недоступны.', 403);
    const score = text(String(body.score ?? ''), 100), comment = text(body.comment, 2000), status = body.status === 'Возвращено на доработку' ? 'Возвращено на доработку' : body.status === 'Проверено' ? 'Проверено' : null;
    if (!status) throw new PushError('Проверьте результат проверки.');
    await db.runTransaction(async tx => {
      const work = await tx.get(ref), a = await tx.get(db.doc(`assignments/${initial.get('assignmentId')}`));
      if (work.get('assignmentId') !== initial.get('assignmentId') || (work.get('userId') && work.get('userId') !== student.id) || work.get('user') !== student.email) throw new PushError('Работа изменилась. Обновите профиль ученика.', 409);
      if (!work.exists || a.get('teacherId') !== actor.user.uid || (work.get('teacherId') && work.get('teacherId') !== actor.user.uid)) throw new PushError('Нет доступа к работе.', 403);
      if (work.get('status') === status && String(work.get('score') ?? '') === score && String(work.get('comment') ?? '') === comment) return;
      const revision = (Number(work.get('reviewRevision')) || 0) + 1;
      tx.update(ref, { status, score, comment, userId: student.id, reviewRevision: revision, reviewedBy: actor.user.uid, reviewedAt: FieldValue.serverTimestamp() });
      createJob(tx, db, `review:${ref.id}:${revision}`, { kind: 'reviewed', submissionId: ref.id, assignmentId: a.id, recipients: [student.id], revision, createdAt: now, availableAt: now });
    }); return { id: ref.id };
  }
  throw new PushError('Неизвестная операция.');
}
