'use client';
import { useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { accountRequest, disableDevicePush, enableDevicePush, pushEnvironment, savedBinding } from '@/lib/push/client';
import s from './PushNotifications.module.css';
export function PushAccountGuard() {
  useEffect(() => onAuthStateChanged(auth, user => { const binding = savedBinding(); if (binding && binding.userId !== user?.uid) void disableDevicePush().catch(() => undefined); }), []);
  return null;
}
export function PushNotifications({ demo = false }: { demo?: boolean }) {
  const [environment, setEnvironment] = useState<ReturnType<typeof pushEnvironment>>(), [active, setActive] = useState(false), [configured, setConfigured] = useState<boolean>(), [busy, setBusy] = useState(false), [notice, setNotice] = useState('');
  useEffect(() => {
    let alive = true;
    queueMicrotask(() => { if (alive) setEnvironment(pushEnvironment()); });
    if (!demo) void accountRequest<{ configured: boolean }>('/api/push').then(async c => {
      if (alive) setConfigured(c.configured);
      const binding = savedBinding();
      if (binding && binding.userId === auth.currentUser?.uid) {
        const state = await accountRequest<{ active: boolean }>('/api/push', { action: 'status', id: binding.id, deviceId: binding.deviceId });
        const sub = await (await navigator.serviceWorker.getRegistration('/'))?.pushManager?.getSubscription();
        if (alive) setActive(Boolean(state.active && sub && Notification.permission === 'granted'));
      }
    }).catch(() => { if (alive) setNotice('Не удалось проверить настройки. Проверьте соединение и войдите заново.'); });
    return () => { alive = false; };
  }, [demo]);
  const needsInstall = environment?.ios && !environment.standalone;
  async function run(action: 'enable' | 'test' | 'disable') {
    setBusy(true); setNotice('');
    try {
      if (action === 'enable') { await enableDevicePush(); setActive(true); setNotice('Уведомления включены на этом устройстве.'); }
      if (action === 'test') { const binding = savedBinding(); if (!binding) throw Error('Сначала включите уведомления.'); await accountRequest('/api/push', { action: 'test', id: binding.id, deviceId: binding.deviceId }); setNotice('Тест поставлен в очередь. Дождитесь уведомления; статус очереди не подтверждает доставку на телефон.'); }
      if (action === 'disable') { const result = await disableDevicePush(); setActive(false); setNotice(result.detached ? 'Уведомления на этом устройстве выключены. Другие устройства продолжают работать.' : 'На устройстве уведомления выключены. Сервер недоступен; недействительная подписка будет удалена при следующей отправке.'); }
    } catch (error) { setNotice(error instanceof Error ? error.message : 'Не удалось изменить настройки.'); }
    finally { setEnvironment(pushEnvironment()); setBusy(false); }
  }
  const actions = <div className={s.actions}><button disabled={demo || busy || active || !environment?.supported || needsInstall || configured !== true || environment.permission === 'denied'} onClick={() => void run('enable')}>Включить на этом устройстве</button><button disabled={demo || busy || !active} onClick={() => void run('test')}>Отправить тестовое уведомление</button><button disabled={demo || busy || (!active && !savedBinding())} onClick={() => void run('disable')}>Выключить на этом устройстве</button></div>;
  return <section className={s.panel} aria-labelledby="push-heading"><span className={s.eyebrow}>НА ЭТОМ УСТРОЙСТВЕ</span><h2 id="push-heading">Уведомления</h2>
    <p>Новая домашка, напоминание за сутки и результат проверки. Оценки и комментарии остаются в кабинете.</p>
    <div className={s.status} role="status">{active ? 'Подключено на этом устройстве' : 'Уведомления выключены'}</div>
    {demo ? <><p>Для настоящих уведомлений войдите в аккаунт ученика. В демо-режиме подписка не создаётся.</p>{actions}</> : <>
      {needsInstall && <div className={s.help}><strong>На iPhone: iOS 16.4 или новее</strong><ol><li>Откройте сайт в Safari.</li><li>Нажмите «Поделиться» → «На экран Домой».</li><li>Откройте приложение с новой иконки, войдите и нажмите «Включить на этом устройстве».</li></ol></div>}
      {!needsInstall && environment && !environment.supported && <p>Этот браузер не поддерживает Web Push. На Android откройте сайт в Chrome, на iPhone используйте приложение с экрана «Домой» и iOS 16.4+.</p>}
      {environment?.permission === 'denied' && <p>Браузер блокирует уведомления. Разрешите их в настройках сайта или приложения. На iPhone: «Настройки» → «Уведомления» → «Физика с Егором». Также проверьте режим фокусирования.</p>}
      {configured === false && <p>Отправка ещё не включена преподавателем. Настройка устройства станет доступна после подключения сервера.</p>}
      {actions}
      <p className={s.hint}>На Android с Chrome включайте прямо здесь. Уведомления могут приходить при закрытой вкладке, если система разрешает доставку. Интернет, разрешения и ограничения энергосбережения влияют на неё.</p>
    </>}{notice && <p role="status" className={s.notice}>{notice}</p>}{busy && <p role="status">Сохраняем настройки…</p>}
  </section>;
}
