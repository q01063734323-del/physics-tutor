import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { createECDH, randomBytes, randomUUID } from 'node:crypto';
import ts from 'typescript';
import * as webpush from 'web-push';
import { IDBFactory } from 'fake-indexeddb';
const require = createRequire(import.meta.url), originalNow = Date.now;
let now = Date.parse('2026-11-21T10:00:00Z'); Date.now = () => now;
const envNames = ['WEB_PUSH_ENABLED', 'WEB_PUSH_PUBLIC_KEY', 'WEB_PUSH_PRIVATE_KEY', 'WEB_PUSH_SUBJECT', 'PUSH_CRON_SECRET'];
const savedEnv = Object.fromEntries(envNames.map(k => [k, process.env[k]]));
const keys = webpush.generateVAPIDKeys(); Object.assign(process.env, { WEB_PUSH_ENABLED: 'true', WEB_PUSH_PUBLIC_KEY: keys.publicKey, WEB_PUSH_PRIVATE_KEY: keys.privateKey, WEB_PUSH_SUBJECT: 'mailto:test@example.com', PUSH_CRON_SECRET: 's'.repeat(64) });
const DELETE = Symbol('delete'), cache = new Map(), afterTasks = [];
function makeDb() {
  const records = new Map(); let mutex = Promise.resolve();
  function apply(key, data, merge = false) { const value = { ...(merge ? records.get(key) : {}) }; for (const [k, v] of Object.entries(data)) { if (v === DELETE) delete value[k]; else value[k] = structuredClone(v); } records.set(key, value); }
  function snap(key) { const data = records.get(key); return { id: key.split('/').at(-1), ref: ref(key), exists: records.has(key), get: k => data?.[k], data: () => data ? structuredClone(data) : undefined }; }
  function ref(key) { return { key, id: key.split('/').at(-1), get: async () => snap(key), set: async (v, o) => apply(key, v, o?.merge), update: async v => { assert(records.has(key)); apply(key, v, true); }, delete: async () => records.delete(key) }; }
  function collection(name) { const filters = []; let cap = Infinity, order;
    return { where(k, op, v) { filters.push([k, op, v]); return this; }, orderBy(k) { order = k; return this; }, limit(n) { cap = n; return this; }, doc: id => ref(name + '/' + id), async get() {
      let docs = [...records.keys()].filter(k => k.startsWith(name + '/') && k.split('/').length === name.split('/').length + 1).map(snap).filter(d => filters.every(([k, op, v]) => op === '==' ? d.get(k) === v : op === '<=' ? typeof d.get(k) === 'number' && d.get(k) <= v : false));
      if (order) docs.sort((a, b) => a.get(order) - b.get(order)); docs = docs.slice(0, cap); return { docs, size: docs.length, empty: !docs.length };
    } };
  }
  const db = { records, doc: ref, collection, getAll: async (...refs) => Promise.all(refs.map(r => r.get())), runTransaction(fn) {
    const next = mutex.then(async () => { const writes = []; const tx = { async get(r) { assert.equal(writes.length, 0, 'all Firestore reads precede writes'); return r.get(); }, set(r, v, o) { writes.push(() => apply(r.key, v, o?.merge)); }, create(r, v) { writes.push(() => { assert(!records.has(r.key), 'create is exclusive'); apply(r.key, v); }); }, update(r, v) { writes.push(() => { assert(records.has(r.key)); apply(r.key, v, true); }); }, delete(r) { writes.push(() => records.delete(r.key)); } }; const result = await fn(tx); writes.forEach(w => w()); return result; }); mutex = next.catch(() => {}); return next;
  } }; return db;
}
let db = makeDb();
function seed() { db = makeDb(); for (const uid of ['alice', 'bob']) { db.records.set('users/' + uid, { email: uid + '@example.com', role: 'student', status: 'active' }); db.records.set('teacherStudents/' + uid, { teacherId: 'teacher', studentId: uid, status: 'active' }); } return db; }
const actor = uid => ({ db, user: { uid, email: uid === 'teacher' ? 'e.galkin07@mail.ru' : uid + '@example.com' }, teacher: uid === 'teacher' });
async function access(request) { const uid = request.headers.get('authorization')?.replace('Bearer ', ''); if (!['alice', 'bob', 'teacher'].includes(uid)) throw Error('401'); return actor(uid); }
async function load(file) {
  file = path.resolve(file); if (cache.has(file)) return cache.get(file).exports;
  const loaded = { exports: {} }; cache.set(file, loaded);
  const source = await fs.readFile(file, 'utf8'); const names = [...source.matchAll(/(?:from\s*|import\s*)['"]([^'"]+)['"]/g)].map(m => m[1]);
  const resolved = new Map();
  for (const name of names) {
    if (name === 'server-only') resolved.set(name, {});
    else if (name === 'firebase-admin/firestore') resolved.set(name, { FieldValue: { serverTimestamp: () => now, delete: () => DELETE } });
    else if (name.endsWith('command-center/access')) resolved.set(name, { preparationAccess: access });
    else if (name.endsWith('firebase-admin')) resolved.set(name, { getFirebaseAdmin: () => ({ adminDb: db }) });
    else if (name === 'web-push') resolved.set(name, { ...webpush, sendNotification: async () => ({ statusCode: 201 }) });
    else if (name === '../firebase' && file.endsWith('/push/client.ts')) resolved.set(name, { auth: { currentUser: { uid:'alice', getIdToken: async () => 'test-token' } } });
    else if (name === 'next/server') resolved.set(name, { after: fn => afterTasks.push(fn) });
    else if (name.startsWith('.') || name.startsWith('@/')) { const target = name.startsWith('@/') ? path.join(process.cwd(), 'src', name.slice(2)) : path.resolve(path.dirname(file), name); resolved.set(name, await load(target + '.ts')); }
    else resolved.set(name, require(name));
  }
  const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  vm.runInThisContext(`(function(require,module,exports){${output}\n})`, { filename: file })(name => resolved.has(name) ? resolved.get(name) : require(name), loaded, loaded.exports); return loaded.exports;
}
try {
  const policy = await load('src/lib/push/policy.ts'), service = await load('src/lib/push/server.ts'), homework = await load('src/lib/push/homework.ts');
  const api = await load('src/app/api/push/route.ts'), hwApi = await load('src/app/api/homework/route.ts'), cronApi = await load('src/app/api/push/dispatch/route.ts');
  const { DAY } = policy;
  assert.equal(policy.dueTime('2026-11-22'), Date.parse('2026-11-22T20:59:00Z'));
  assert.equal(policy.dueTime('2026-02-30'), null); assert.equal(policy.dueTime('2026-99-99'), null);
  for (const endpoint of ['http://fcm.googleapis.com/a', 'https://127.0.0.1/a', 'https://fcm.googleapis.com.evil/a', 'https://user:secret@fcm.googleapis.com/a']) assert(!policy.safePushEndpoint(endpoint));
  const subscription = name => { const ec = createECDH('prime256v1'); ec.generateKeys(); return { endpoint: 'https://fcm.googleapis.com/fcm/send/' + name, keys: { p256dh: ec.getPublicKey().toString('base64url'), auth: randomBytes(16).toString('base64url') } }; };
  const devices = {};
  async function bind(uid, name) { const deviceId = randomUUID(); const s = subscription(name), bound = await service.bindSubscription(db, uid, deviceId, s); devices[name] = { ...bound, deviceId, subscription: s }; return devices[name]; }
  const create = (requestId, dueDate, audience = 'student', assignedToId = 'alice') => homework.mutateHomework(actor('teacher'), { action: 'create', requestId, assignment: { title: 'Кинематика', description: 'Условие', audience, assignedToId, dueDate } });
  const review = (id, status, comment = 'Разберите знак скорости.') => homework.mutateHomework(actor('teacher'), { action: 'review', submissionId: id, status, score: '8', comment });
  let sent = []; const send = async (sub, data) => sent.push({ endpoint: sub.endpoint, ...JSON.parse(data) });
  seed(); await bind('alice', 'phone'); await bind('alice', 'tablet'); await bind('bob', 'bob-phone');
  const due = new Date(now + 3 * DAY).toISOString(); const first = await create('request-one', due);
  assert.equal((await create('request-one', due)).id, first.id); assert.equal(db.records.size > 0, true);
  const before = [...db.records.keys()].filter(k => k.startsWith('pushJobs/')).length;
  await Promise.all([service.dispatchPush(db, send), service.dispatchPush(db, send)]); assert.equal(sent.length, 2); assert(sent.every(n => n.endpoint.includes('phone') || n.endpoint.includes('tablet'))); assert(sent.every(n => !n.endpoint.includes('bob-phone')));
  await service.dispatchPush(db, send); assert.equal(sent.length, 2);
  await homework.mutateHomework(actor('teacher'), { action: 'edit', assignmentId: first.id, patch: { title: 'Новое название' } }); await service.dispatchPush(db, send); assert.equal(sent.length, 2); assert.equal([...db.records.keys()].filter(k => k.startsWith('pushJobs/')).length, before);
  await assert.rejects(homework.readHomework(actor('bob'), first.id), /недоступна/);
  const read = await homework.readHomework(actor('alice'), first.id); assert.equal(read.assignment.id, first.id); assert.equal(read.assignment.pushRecipients, undefined);
  now = Date.parse(due) - DAY; await service.dispatchPush(db, send); assert.equal(sent.length, 4); assert(sent.slice(2).every(n => n.body.includes('сутки'))); await service.dispatchPush(db, send); assert.equal(sent.length, 4);
  const secondDue = new Date(now + 3 * DAY).toISOString(), second = await create('request-two', secondDue); await service.dispatchPush(db, send);
  const submissionInput = { assignmentId: second.id, fileUrl: 'https://res.cloudinary.com/y3gl6xsx/raw/upload/work.pdf', fileName: 'work.pdf', fileType: 'application/pdf', fileSize: 1200, userId: 'bob', score: '100' };
  await assert.rejects(homework.mutateHomework(actor('bob'), { action: 'submit', requestId: 'spoof', submission: submissionInput }));
  const submitted = await homework.mutateHomework(actor('alice'), { action: 'submit', requestId: 'submitted-one', submission: submissionInput });
  assert.equal(db.records.get('submissions/' + submitted.id).userId, 'alice'); assert.equal(db.records.get('submissions/' + submitted.id).score, '');
  const count = sent.length; now = Date.parse(secondDue) - DAY; await service.dispatchPush(db, send); assert.equal(sent.length, count, 'submitted homework cannot remind');
  await review(submitted.id, 'Проверено'); await service.dispatchPush(db, send); assert.equal(sent.length, count + 2); assert(sent.at(-1).body === 'Домашняя работа проверена'); assert(!JSON.stringify(sent.at(-1)).includes('скорости'));
  await review(submitted.id, 'Проверено'); await service.dispatchPush(db, send); assert.equal(sent.length, count + 2, 'unchanged review save is idempotent');
  await review(submitted.id, 'Возвращено на доработку'); await service.dispatchPush(db, send); assert.equal(sent.length, count + 4);
  await service.unbindSubscription(db, 'alice', devices.phone.id, devices.phone.deviceId); await review(submitted.id, 'Проверено', 'Новый итог'); await service.dispatchPush(db, send); assert.equal(sent.length, count + 5); assert(sent.at(-1).endpoint.includes('tablet'));
  const detailed = await homework.readHomework(actor('alice'), second.id); assert.equal(detailed.submissions[0].comment, 'Новый итог');
  await assert.rejects(homework.mutateHomework(actor('bob'), { action: 'review', submissionId: submitted.id, status: 'Проверено' }));
  // Existing future work can be seeded without re-announcing old assignments.
  db.records.set('assignments/legacy-future',{teacherId:'teacher',title:'Старая работа',description:'Условие',audience:'student',assignedToId:'alice',dueDate:new Date(now+4*DAY).toISOString(),createdAt:now-DAY});
  assert((await homework.mutateHomework(actor('teacher'),{action:'schedule-existing'})).scheduled>=1);
  assert.equal((await homework.mutateHomework(actor('teacher'),{action:'schedule-existing'})).scheduled,0);
  assert(![...db.records.values()].some(j=>j.kind==='assigned'&&j.assignmentId==='legacy-future'));
  // Moved deadline cancels the obsolete event and schedules the new one.
  seed(); await bind('alice', 'move'); sent = []; const originalDue = new Date(now + 3 * DAY).toISOString(), moved = await create('move', originalDue); await service.dispatchPush(db, send);
  const laterDue = new Date(now + 5 * DAY).toISOString(); await homework.mutateHomework(actor('teacher'), { action: 'edit', assignmentId: moved.id, patch: { dueDate: laterDue } });
  now = Date.parse(originalDue) - DAY; await service.dispatchPush(db, send); assert.equal(sent.length, 1);
  now = Date.parse(laterDue) - DAY; await service.dispatchPush(db, send); assert.equal(sent.length, 2); await service.dispatchPush(db, send); assert.equal(sent.length, 2);
  const cancelledWork = await create('cancel', new Date(now + 3 * DAY).toISOString()); await homework.mutateHomework(actor('teacher'), { action: 'edit', assignmentId: cancelledWork.id, patch: { status: 'cancelled' } }); await service.dispatchPush(db, send); assert.equal(sent.length, 2);
  const short = await create('short', new Date(now + 2 * 3600000).toISOString()); assert.equal([...db.records.values()].filter(j => j.assignmentId === short.id && j.kind === 'deadline').length, 0);
  // Ambiguous network result is terminal and never automatically repeats.
  seed(); await bind('alice', 'uncertain'); await create('uncertain', null); let calls = 0;
  await service.dispatchPush(db, async () => { calls++; throw Error('timeout after service may have accepted'); }); await service.dispatchPush(db, async () => calls++); assert.equal(calls, 1); assert([...db.records.values()].some(r => r.status === 'uncertain'));
  // Definite throttling retries later; expired endpoints are removed, not retried.
  seed(); await bind('alice', 'retry'); await create('retry', null); calls = 0;
  await service.dispatchPush(db, async () => { calls++; throw Object.assign(Error('rate'), { statusCode: 429 }); }); await service.dispatchPush(db, async () => calls++); assert.equal(calls, 1); now += 300001; await service.dispatchPush(db, async () => calls++); assert.equal(calls, 2); await service.dispatchPush(db, async () => calls++); assert.equal(calls, 2);
  seed(); await bind('alice', 'expired'); await create('expired', null); await service.dispatchPush(db, async () => { throw Object.assign(Error('gone'), { statusCode: 410 }); }); assert.equal([...db.records.keys()].filter(k => k.startsWith('pushSubscriptions/')).length, 0);
  // A large group resumes from a durable cursor; throttled devices survive partial batches.
  seed(); await bind('alice', 'batch-alice'); await bind('bob', 'batch-bob'); await create('batch', null, 'class');
  let aliceCalls=0,bobCalls=0;
  await service.dispatchPush(db, async sub => { if(sub.endpoint.includes('alice')){aliceCalls++;now+=100;throw Object.assign(Error('rate'),{statusCode:429});}bobCalls++; },50);
  await service.dispatchPush(db, async sub => { if(sub.endpoint.includes('alice'))aliceCalls++;else bobCalls++; });
  assert.equal(aliceCalls,1);assert.equal(bobCalls,1);now+=300001;
  await service.dispatchPush(db, async sub => { if(sub.endpoint.includes('alice'))aliceCalls++;else bobCalls++; });
  assert.equal(aliceCalls,2);assert.equal(bobCalls,1);
  // API authentication, account/device ownership, origin and cron boundaries.
  seed(); const aliceDevice = await bind('alice', 'api-alice'); await bind('bob', 'api-bob');
  const req = (user, body, url = '/api/push', origin = 'https://example.test') => new Request('https://example.test' + url, { method: body ? 'POST' : 'GET', headers: { ...(user ? { Authorization: 'Bearer ' + user } : {}), Origin: origin, 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });
  assert.equal((await api.GET(req(null))).status, 401); assert.equal((await hwApi.GET(req(null, null, '/api/homework?assignment=unknown'))).status, 401);
  assert.equal((await api.POST(req('bob', { action: 'test', id: aliceDevice.id, deviceId: aliceDevice.deviceId }))).status, 409);
  assert.equal((await api.POST(req('alice', { action: 'test', id: aliceDevice.id, deviceId: aliceDevice.deviceId }, '/api/push', 'https://evil.test'))).status, 403);
  assert.equal((await api.POST(req('alice', { action: 'test', id: aliceDevice.id, deviceId: aliceDevice.deviceId }))).status, 200);
  assert.equal((await api.POST(req('alice', { action: 'test', id: aliceDevice.id, deviceId: aliceDevice.deviceId }))).status, 429);
  assert.equal((await cronApi.POST(req(null, {}))).status, 401);
  assert.equal((await cronApi.POST(req('s'.repeat(64), {}))).status, 200);
  // A lost HTTP response reuses the same creation ID, while a later intentional create gets a new ID.
  const client = await load('src/lib/push/client.ts'), realFetch = globalThis.fetch;
  const requests=[];let failFirst=true;
  globalThis.fetch=async (_url,options)=>{requests.push(JSON.parse(options.body));if(failFirst){failFirst=false;throw Error('response lost');}return Response.json({id:'saved'});};
  try { await assert.rejects(client.homeworkRequest('create',{assignment:{title:'a'}},{title:'a'}));await client.homeworkRequest('create',{assignment:{title:'a'}},{title:'a'});assert.equal(requests[0].requestId,requests[1].requestId);await client.homeworkRequest('create',{assignment:{title:'a'}},{title:'a'});assert.notEqual(requests[1].requestId,requests[2].requestId); } finally { globalThis.fetch=realFetch; }
  // Logout disables persistent worker binding, unsubscribes locally and detaches only this device.
  const descriptors=Object.fromEntries(['navigator','indexedDB','localStorage','Notification'].map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)]));
  const local=new Map();let unsubscribed=0,closed=0,permissionRequests=0;const logoutRequests=[];
  Object.defineProperty(globalThis,'indexedDB',{value:new IDBFactory(),configurable:true});
  Object.defineProperty(globalThis,'localStorage',{value:{getItem:k=>local.get(k)||null,setItem:(k,v)=>local.set(k,v),removeItem:k=>local.delete(k)},configurable:true});
  Object.defineProperty(globalThis,'navigator',{value:{serviceWorker:{getRegistration:async()=>({pushManager:{getSubscription:async()=>({unsubscribe:async()=>{unsubscribed++;return true;}})},getNotifications:async()=>[{close(){closed++;}}]})}},configurable:true});
  Object.defineProperty(globalThis,'Notification',{value:{permission:'default',requestPermission:async()=>{permissionRequests++;return 'denied';}},configurable:true});
  globalThis.fetch=async(_url,options)=>{logoutRequests.push(JSON.parse(options.body));return Response.json({removed:true});};
  try {
    assert.equal(permissionRequests,0);await assert.rejects(client.enableDevicePush(),/Разрешение/);assert.equal(permissionRequests,1);assert.equal(logoutRequests.length,0);
    local.set('physics-push-binding-v1',JSON.stringify({id:aliceDevice.id,binding:'old',userId:'alice',deviceId:aliceDevice.deviceId}));
    assert.equal((await client.disableDevicePush()).detached,true);assert.equal(unsubscribed,1);assert.equal(closed,1);assert.equal(logoutRequests[0].action,'unsubscribe');assert.equal(logoutRequests[0].deviceId,aliceDevice.deviceId);assert(!local.has('physics-push-binding-v1'));
    const opened=globalThis.indexedDB.open('physics-push-v1',1);await new Promise(resolve=>{opened.onsuccess=resolve;});const read=opened.result.transaction('state').objectStore('state').get('binding');await new Promise(resolve=>{read.onsuccess=resolve;});assert.equal(read.result.enabled,false);opened.result.close();
  } finally { globalThis.fetch=realFetch;for(const k of Object.keys(descriptors)){if(descriptors[k])Object.defineProperty(globalThis,k,descriptors[k]);else delete globalThis[k];} }
  // Service worker: real IndexedDB, account binding, replay suppression and safe click destination.
  const indexedDB = new IDBFactory(), listeners = new Map(), notifications = [], opened = [];
  const self = { location: { origin: 'https://example.test' }, addEventListener: (name, fn) => listeners.set(name, fn), registration: { showNotification: async (title, options) => notifications.push({ title, ...options }) }, clients: { matchAll: async () => [], openWindow: async url => opened.push(url) } };
  vm.runInNewContext(await fs.readFile('public/sw.js', 'utf8'), { self, indexedDB, URL, console, Date, Promise });
  async function setBinding(value) { const open = indexedDB.open('physics-push-v1', 1); await new Promise((resolve, reject) => { open.onupgradeneeded = () => { open.result.createObjectStore('state'); open.result.createObjectStore('seen'); }; open.onsuccess = resolve; open.onerror = reject; }); const d = open.result; await new Promise((resolve, reject) => { const tx = d.transaction('state', 'readwrite'); tx.objectStore('state').put(value, 'binding'); tx.oncomplete = resolve; tx.onerror = reject; }); d.close(); }
  const emit = async (name, event) => { let promise; listeners.get(name)({ ...event, waitUntil: p => { promise = p; } }); await promise; };
  const payload = policy.notificationPayload('reviewed', 'work-1', 'a'.repeat(64), 'alice-binding');
  await setBinding({ enabled: true, binding: 'alice-binding' });
  await emit('push', { data: { json: () => payload } }); await emit('push', { data: { json: () => payload } }); assert.equal(notifications.length, 1); assert.equal(notifications[0].body, 'Домашняя работа проверена');
  await emit('notificationclick', { notification: { data: notifications[0].data, close() {} } }); assert.equal(opened[0], 'https://example.test/student?assignment=work-1');
  await setBinding({ enabled: false }); await emit('push', { data: { json: () => ({ ...payload, eventId: 'b'.repeat(64) }) } }); assert.equal(notifications.length, 1);
  await emit('notificationclick', { notification: { data: notifications[0].data, close() {} } }); assert.equal(opened.length, 1);
  await setBinding({ enabled: true, binding: 'bob-binding' }); await emit('push', { data: { json: () => ({ ...payload, eventId: 'c'.repeat(64) }) } }); assert.equal(notifications.length, 1, 'old account cannot notify new account');
  await emit('push', { data: { json: () => ({ ...payload, binding: 'bob-binding', eventId: 'd'.repeat(64), url: 'https://evil.test' }) } }); assert.equal(notifications.length, 1);
  console.log('Web Push checks passed: atomic outbox/idempotent creation, two devices, student isolation, deadline/status recheck, rescheduling/cancellation, reviewed/returned events, unchanged review suppression, device detach, expired subscriptions, uncertain-send deduplication, 429 retry, API/cron/origin authorization, and service-worker IndexedDB/replay/account/click checks. Firestore and transport mocked; real device delivery is not claimed.');
} finally { Date.now = originalNow; for (const key of envNames) { if (savedEnv[key] === undefined) delete process.env[key]; else process.env[key] = savedEnv[key]; } }
