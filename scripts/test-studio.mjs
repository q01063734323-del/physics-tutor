import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import ts from "typescript";
import { TokenVerifier } from "livekit-server-sdk";
const root = await fs.mkdtemp(path.join(os.tmpdir(), "physics-studio-test-"));
const require = createRequire(import.meta.url);
try {
  const names = ["src/lib/studio/preview-media.ts", "src/lib/studio/model.ts", "src/lib/studio/creation-limit.ts", "src/lib/classroom.ts", "src/app/api/classroom/route.ts"];
  for (const name of names) {
    let source = await fs.readFile(name, "utf8");
    source = source.replaceAll('"@/lib/firebase-admin"', JSON.stringify(path.join(root, "admin.js"))).replaceAll('"@/lib/classroom"', JSON.stringify(path.join(root, "src/lib/classroom.js"))).replaceAll('"@/lib/studio/creation-limit"', JSON.stringify(path.join(root, "src/lib/studio/creation-limit.js"))).replaceAll('"livekit-server-sdk"', JSON.stringify(require.resolve("livekit-server-sdk")));
    const target = path.join(root, name.replace(/\.ts$/, ".js")); await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText);
  }
  const { withMediaTimeout } = require(path.join(root, "src/lib/studio/preview-media.js"));
  let releaseLate, stoppedLate = false;
  const lateCapture = new Promise(resolve => { releaseLate = resolve; });
  await assert.rejects(withMediaTimeout(lateCapture, 5), { name: "TimeoutError" });
  releaseLate({ getTracks: () => [{ stop: () => { stoppedLate = true; } }] });
  await new Promise(resolve => setImmediate(resolve)); assert(stoppedLate, "late camera permission must release the stream");
  const readyStream = { getTracks: () => [] }; assert.equal(await withMediaTimeout(Promise.resolve(readyStream), 100), readyStream);
  const model = require(path.join(root, "src/lib/studio/model.js"));
  assert.deepEqual(model.normalizeLayout(null), model.defaultLayout);
  const bounded = model.normalizeLayout({ mode: "free", railWidth: 10000, cameraWidth: -8, positions: { teacher: { x: -20, y: 100 }, student: { x: NaN, y: 1 }, constructor: { x: 1, y: 1 } }, hidden: ["teacher", "teacher", "outsider"] });
  assert.equal(bounded.railWidth, 340); assert.equal(bounded.cameraWidth, 140); assert.deepEqual(bounded.positions, { teacher: { x: 0, y: 1 } }); assert.deepEqual(bounded.hidden, ["teacher"]);
  assert.equal(model.normalizeLayout({ mode: "not-a-mode" }).mode, "studio");
  const encode = value => new TextEncoder().encode(JSON.stringify(value));
  const message = { id: crypto.randomUUID(), text: "  F = ma <script>alert(1)</script>  ", at: Date.now() };
  assert.equal(model.readChatPacket(encode(message)).text, message.text.trim(), "user content remains plain text");
  for (const bad of [{...message, text:" "}, {...message, text:"a".repeat(1201)}, {...message, id:"-".repeat(36)}, {...message, at:"now"}, null, []]) assert.equal(model.readChatPacket(encode(bad)), null);
  assert.equal(model.readChatPacket(new Uint8Array(8193)), null);
  assert.equal(model.readChatPacket(new TextEncoder().encode("bad json")), null);
  const { createRoomCreationLimit } = require(path.join(root, "src/lib/studio/creation-limit.js"));
  const gate = createRoomCreationLimit(2, 100); assert(gate("a",0)); assert(gate("a",1)); assert(!gate("a",2)); assert(gate("b",2)); assert(gate("a",101)); assert(!gate("",103));
  await fs.writeFile(path.join(root, "admin.js"), `
    const records=new Map();exports.records=records;
    const users={teacher:{uid:'teacher',email:'e.galkin07@mail.ru'},alice:{uid:'alice',email:'alice@example.test'},bob:{uid:'bob',email:'bob@example.test'},blocked:{uid:'blocked',email:'blocked@example.test'}};
    for(const id of ['alice','bob','blocked'])records.set('users/'+id,{role:'student',status:id==='blocked'?'blocked':'active',displayName:id});
    function ref(path){return {path,get:async()=>({data:()=>records.get(path)}),collection:name=>({doc:id=>ref(path+'/'+name+'/'+id)})}}
    const db={doc:ref,collection:()=>({where(){return this},limit(){return this},get:async()=>({empty:false,docs:[]})}),batch:()=>{const writes=[];return {create:(r,d)=>writes.push([r,d]),commit:async()=>{for(const [r,d]of writes)records.set(r.path,{...d,expiresAt:{toMillis:()=>d.expiresAt.getTime()}})}}}};
    exports.getFirebaseAdmin=()=>({adminDb:db,adminAuth:{verifyIdToken:async token=>{if(!users[token])throw Error('bad-token');return users[token]}}});
  `);
  const admin = require(path.join(root, "admin.js"));
  process.env.LIVEKIT_URL="wss://rooms.example.test"; process.env.LIVEKIT_API_KEY="test-key"; process.env.LIVEKIT_API_SECRET="test-secret-with-at-least-thirty-two-characters";
  const api = require(path.join(root, "src/app/api/classroom/route.js"));
  const request = (user, body, extra = {}) => new Request("https://physics.example.test/api/classroom", { method:"POST", headers:{...(user?{Authorization:`Bearer ${user}`} : {}),"Content-Type":"application/json", ...extra}, body:JSON.stringify(body) });
  assert.equal((await api.POST(request(null,{action:"create",studentId:"alice"}))).status,401);
  assert.equal((await api.POST(request("blocked",{action:"create",studentId:"alice"}))).status,403);
  assert.equal((await api.POST(request("alice",{action:"create",studentId:"alice"}))).status,403);
  assert.equal((await api.POST(request("teacher",{action:"create",studentId:"alice"},{"sec-fetch-site":"cross-site"}))).status,403);
  const create = await api.POST(request("teacher",{action:"create",studentId:"alice"})); assert.equal(create.status,200); const lesson=await create.json();
  assert.equal(create.headers.get("cache-control"),"no-store"); assert.equal(lesson.role,"teacher");
  const verify = new TokenVerifier(process.env.LIVEKIT_API_KEY,process.env.LIVEKIT_API_SECRET);
  const teacher = await verify.verify(lesson.token); assert(teacher.video.canPublishSources.includes("screen_share")); assert.equal(teacher.video.canPublishData,true); assert.equal(teacher.roomConfig.maxParticipants,2);
  const joined = await api.POST(request("alice",{action:"join",roomId:lesson.roomId})); assert.equal(joined.status,200);
  const student = await verify.verify((await joined.json()).token); assert.equal(student.sub,"alice"); assert.equal(student.video.room,teacher.video.room); assert.equal(student.video.canPublishData,true); assert(!student.video.canPublishSources.includes("screen_share"));
  assert.equal((await api.POST(request("bob",{action:"join",roomId:lesson.roomId}))).status,403);
  assert.equal((await api.POST(request("alice",{action:"end",roomId:lesson.roomId}))).status,403);
  admin.records.get('classroomRooms/'+lesson.roomId).studentRemoved=true;
  assert.equal((await api.POST(request("alice",{action:"join",roomId:lesson.roomId}))).status,403);
  admin.records.get('classroomRooms/'+lesson.roomId).studentRemoved=false;
  admin.records.get('classroomRooms/'+lesson.roomId).status='ended';
  assert.equal((await api.POST(request("alice",{action:"join",roomId:lesson.roomId}))).status,410);
  const mediaSource=await fs.readFile('src/lib/use-classroom-media.ts','utf8');
  let effect,states=[],instances=[];
  const hooks={useEffect:fn=>{effect=fn},useState:initial=>[initial,state=>states.push(state)]};
  const events={ConnectionStateChanged:'state',ActiveSpeakersChanged:'speakers',ConnectionQualityChanged:'quality'};
  class MockRoom {
    state='connected'; remoteParticipants=new Map(); canPlaybackAudio=true; disconnected=0;
    constructor(options){this.options=options;instances.push(this);this.stops=0;this.cameraCalls=0;this.micCalls=0;this.localParticipant={identity:'teacher',name:'Teacher',metadata:'{"role":"teacher"}',trackPublications:new Map([['camera',{track:{stop:()=>this.stops++}}]]),getTrackPublication:()=>undefined,setCameraEnabled:async()=>{this.cameraCalls++},setMicrophoneEnabled:async()=>{this.micCalls++}}}
    on(){return this} removeAllListeners(){this.removed=true} connect(){return Promise.resolve()} disconnect(){this.disconnected++;return Promise.resolve()}
  }
  const pages=new Map();global.window={addEventListener:(k,v)=>pages.set(k,v),removeEventListener:k=>pages.delete(k)};
  const transpiled=ts.transpileModule(mediaSource,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  const qualityExports={};new Function('exports','require',ts.transpileModule(await fs.readFile('src/lib/studio/quality.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(qualityExports,()=>({LocalVideoTrack:class{},Track:{Source:{}}}));
  const mediaExports={}; const fakeRequire=name=>name==='react'?hooks:name==='./studio/quality'?qualityExports:name==='livekit-client'?{Room:MockRoom,RoomEvent:events,Track:{Source:{}},ConnectionState:{Connecting:'connecting',Disconnected:'disconnected'}}:{};
  new Function('require','exports',transpiled)(fakeRequire,mediaExports);
  mediaExports.useClassroomMedia({url:'wss://rooms.example.test',token:'test'},()=>{},()=>{},false);
  let dispose=effect();await new Promise(resolve=>setImmediate(resolve));assert.equal(instances.at(-1).cameraCalls,0);assert.equal(instances.at(-1).micCalls,0);pages.get('pagehide')();assert(instances.at(-1).stops>0);dispose();assert(instances.at(-1).removed);assert.equal(pages.size,0);
  mediaExports.useClassroomMedia({url:'wss://rooms.example.test',token:'test'},()=>{},()=>{},{camera:true,microphone:true});
  dispose=effect();await new Promise(resolve=>setImmediate(resolve));assert.equal(instances.at(-1).cameraCalls,1);assert.equal(instances.at(-1).micCalls,1);dispose();
  mediaExports.useClassroomMedia({url:'wss://rooms.example.test',token:'test'},()=>{},()=>{},{camera:true,microphone:true});
  dispose=effect();dispose();await new Promise(resolve=>setImmediate(resolve));assert.equal(instances.at(-1).cameraCalls,0,'unmounted pending connect must not activate devices');
  console.log('studio checks passed: bounded layouts; chat validation; burst limits; real signed role grants; two-person cap; rejected outsiders/removed/ended lessons; student cannot share or end; prejoin device choices; disconnect/pagehide cleanup; pending-connect cancellation. External Firebase/LiveKit I/O mocked; no real call claimed.');
} finally { await fs.rm(root,{recursive:true,force:true}); }
