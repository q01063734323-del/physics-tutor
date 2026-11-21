'use client';
import { auth } from '../firebase';
const LOCAL = 'physics-push-binding-v1', DEVICE = 'physics-push-device-v1';
export type LocalBinding = { id: string; binding: string; userId: string; deviceId: string };
export function savedBinding(): LocalBinding | null { try { const data = JSON.parse(localStorage.getItem(LOCAL) || 'null'); return data && typeof data.id === 'string' && typeof data.userId === 'string' ? data : null; } catch { return null; } }
export function deviceId() { let id = localStorage.getItem(DEVICE); if (!id || !/^[a-f0-9-]{36}$/.test(id)) { id = crypto.randomUUID(); localStorage.setItem(DEVICE, id); } return id; }
export async function accountRequest<T>(path: string, body?: object): Promise<T> {
  const user = auth.currentUser; if (!user) throw Error('Войдите в аккаунт ученика.');
  const token = await user.getIdToken();
  const result = await fetch(path, { method: body ? 'POST' : 'GET', cache: 'no-store', headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(20_000) });
  const data = await result.json(); if (!result.ok) throw Error(data.error || 'Сервер временно недоступен.');
  if (auth.currentUser?.uid !== user.uid) throw Error('Аккаунт изменился. Повторите вход.'); return data;
}
const pendingRequests = new Map<string, string>();
/** Keep the same operation ID when a response is lost, including after a reload. */
export async function homeworkRequest<T>(action: 'create' | 'submit', payload: object, fingerprint: object): Promise<T> {
  const user = auth.currentUser; if (!user) throw Error('Войдите в аккаунт.');
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(fingerprint)));
  const hash = [...new Uint8Array(bytes)].map(n => n.toString(16).padStart(2, '0')).join('');
  const key = `physics-homework-pending:${user.uid}:${action}:${hash}`;
  let requestId = pendingRequests.get(key);
  try { requestId ||= sessionStorage.getItem(key) || undefined; } catch { /* in-memory retry protection still works */ }
  requestId ||= crypto.randomUUID(); pendingRequests.set(key, requestId);
  try { sessionStorage.setItem(key, requestId); } catch { /* memory fallback */ }
  const result = await accountRequest<T>('/api/homework', { action, requestId, ...payload });
  pendingRequests.delete(key); try { sessionStorage.removeItem(key); } catch { /* memory fallback */ }
  return result;
}
export function writePushState(value: { enabled: boolean; binding?: string }) {
  return new Promise<void>((resolve, reject) => {
    const open = indexedDB.open('physics-push-v1', 1);
    open.onupgradeneeded = () => { open.result.createObjectStore('state'); open.result.createObjectStore('seen'); };
    open.onerror = () => reject(Error('Хранилище устройства недоступно.'));
    open.onsuccess = () => { const db = open.result; const tx = db.transaction('state', 'readwrite'); tx.objectStore('state').put(value, 'binding'); tx.oncomplete = () => { db.close(); resolve(); }; tx.onerror = () => { db.close(); reject(Error('Не удалось сохранить настройки устройства.')); }; };
  });
}
export async function enableDevicePush() {
  // Must be the first permission request after the student's click, never an effect.
  if (Notification.permission !== 'granted' && await Notification.requestPermission() !== 'granted') throw Error('Разрешение не выдано. Включите уведомления в настройках браузера или приложения.');
  const user = auth.currentUser; if (!user) throw Error('Войдите в аккаунт ученика.');
  const config = await accountRequest<{ configured: boolean; publicKey: string | null }>('/api/push');
  if (!config.configured || !config.publicKey) throw Error('Преподаватель ещё не настроил отправку уведомлений.');
  const registration = await navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' });
  await registration.update();
  const worker = registration.waiting || registration.installing;
  if (worker) {
    worker.postMessage({ type: 'SKIP_WAITING' });
    await new Promise<void>((resolve, reject) => { const timeout = setTimeout(() => { worker.removeEventListener('statechange', change); reject(Error('Обновите приложение и повторите включение.')); }, 15_000);
      const change = () => { if (worker.state === 'installed') worker.postMessage({ type: 'SKIP_WAITING' }); if (worker.state === 'activated') { clearTimeout(timeout); worker.removeEventListener('statechange', change); resolve(); } };
      worker.addEventListener('statechange', change); change(); });
  }
  await Promise.race([navigator.serviceWorker.ready, new Promise((_, reject) => setTimeout(() => reject(Error('Service worker не готов. Перезагрузите страницу.')), 15_000))]);
  const key = Uint8Array.from(atob(config.publicKey.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
  let subscription = await registration.pushManager.getSubscription();
  if (subscription?.options.applicationServerKey && !equalBytes(new Uint8Array(subscription.options.applicationServerKey), key)) { await subscription.unsubscribe(); subscription = null; }
  subscription ||= await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key.buffer });
  const bound = await accountRequest<{ id: string; binding: string }>('/api/push', { action: 'subscribe', deviceId: deviceId(), subscription: subscription.toJSON() });
  try { await writePushState({ enabled: true, binding: bound.binding }); localStorage.setItem(LOCAL, JSON.stringify({ ...bound, userId: user.uid, deviceId: deviceId() })); }
  catch (error) { await subscription.unsubscribe(); await accountRequest('/api/push', { action: 'unsubscribe', id: bound.id, deviceId: deviceId() }).catch(() => undefined); throw error; }
}
function equalBytes(a: Uint8Array, b: Uint8Array) { return a.length === b.length && a.every((n, i) => n === b[i]); }
export async function disableDevicePush() {
  const binding = savedBinding(); let blocked = false, unsubscribed = false;
  try { await writePushState({ enabled: false }); blocked = true; } catch { /* Unsubscribe still protects devices with unavailable IndexedDB. */ }
  if ('serviceWorker' in navigator) {
    const registration = await navigator.serviceWorker.getRegistration('/');
    const subscription = await registration?.pushManager?.getSubscription();
    if (subscription) unsubscribed = await subscription.unsubscribe(); else unsubscribed = true;
    for (const notification of await registration?.getNotifications?.() || []) notification.close();
  } else unsubscribed = true;
  if (!blocked && !unsubscribed) throw Error('Не удалось отключить уведомления. Повторите попытку перед выходом.');
  let detached = true;
  if (binding && auth.currentUser?.uid === binding.userId) {
    try { await accountRequest('/api/push', { action: 'unsubscribe', id: binding.id, deviceId: binding.deviceId }); } catch { detached = false; }
  }
  localStorage.removeItem(LOCAL); return { detached };
}
export function pushEnvironment() {
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const standalone = matchMedia('(display-mode: standalone)').matches || Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
  return { ios, standalone, supported: isSecureContext && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window, permission: 'Notification' in window ? Notification.permission : 'default' };
}
