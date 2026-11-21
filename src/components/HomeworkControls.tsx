'use client';
import { useState } from 'react';
import { accountRequest } from '@/lib/push/client';
export function HomeworkControls({ id, title, description, dueDate, cancelled, onSaved }: { id: string; title: string; description: string; dueDate?: string | null; cancelled: boolean; onSaved: (patch: { title: string; text: string; dueDate: string | null; due: string; status: string }) => void }) {
  const [busy, setBusy] = useState(false), [notice, setNotice] = useState('');
  return <details className="push-homework-controls"><summary>Изменить работу</summary><form onSubmit={async event => {
    event.preventDefault(); const data = new FormData(event.currentTarget); setBusy(true); setNotice('');
    const title = String(data.get('title') || ''), description = String(data.get('description') || ''), dueDate = String(data.get('dueDate') || '') || null, status = data.get('cancelled') ? 'cancelled' : 'new';
    try { await accountRequest('/api/homework', { action: 'edit', assignmentId: id, patch: { title, description, dueDate, status } }); onSaved({ title, text: description, dueDate, due: dueDate ? `Сдать до ${dueDate}` : 'Без дедлайна', status }); setNotice('Изменения сохранены. Уведомление о назначении повторно не отправляется.'); } catch (error) { setNotice(error instanceof Error ? error.message : 'Не удалось сохранить.'); } finally { setBusy(false); }
  }}><label>Название<input name="title" required maxLength={200} defaultValue={title}/></label><label>Условие<textarea name="description" maxLength={12000} defaultValue={description}/></label><label>Сдать до (конец дня, Москва)<input name="dueDate" type="date" defaultValue={dueDate?.slice(0, 10) || ''}/></label><label><input type="checkbox" name="cancelled" defaultChecked={cancelled}/>Работа отменена</label><button disabled={busy}>Сохранить изменения</button>{notice && <p role="status">{notice}</p>}</form></details>;
}

export function ExistingReminderSetup() {
  const [busy, setBusy] = useState(false), [notice, setNotice] = useState('');
  return <div className="push-existing-reminders"><button type="button" className="secondary" disabled={busy} onClick={async () => {
    setBusy(true); setNotice(''); let cursor: string | null = null, scheduled = 0;
    try { do { const batch: {scheduled:number;nextCursor:string|null} = await accountRequest('/api/homework', {action:'schedule-existing',cursor}); scheduled += batch.scheduled; cursor = batch.nextCursor; } while(cursor); setNotice(`Подготовлены напоминания для ${scheduled} работ. Уведомления о старых назначениях не отправлялись.`); }
    catch { setNotice('Не удалось завершить. Повторите действие: уже подготовленные напоминания не продублируются.'); } finally { setBusy(false); }
  }}>{busy ? 'Подготавливаем напоминания…' : 'Подготовить напоминания для текущих работ'}</button><p>Однократно после подключения уведомлений. Учитываются работы со сроком не менее чем через сутки.</p>{notice && <p role="status">{notice}</p>}</div>;
}
