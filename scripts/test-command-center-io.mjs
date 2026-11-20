import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {createRequire} from 'node:module';
import ts from 'typescript';
const dir=await fs.mkdtemp(path.join(os.tmpdir(),'command-io-'));const require=createRequire(import.meta.url);
try{
 const compile=async(name,replacements)=>{let source=await fs.readFile(`src/lib/command-center/${name}.ts`,'utf8');for(const [from,to]of Object.entries(replacements))source=source.replaceAll(from,to);await fs.writeFile(path.join(dir,name+'.js'),ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText);};
 await fs.writeFile(path.join(dir,'storage.js'),`const records=new Map();exports.records=records;exports.readLocalRecord=async(k,f)=>structuredClone(records.get(k)??f);exports.writeLocalRecord=async(k,v)=>records.set(k,structuredClone(v));`);
 await fs.writeFile(path.join(dir,'firebase.js'),`exports.auth={currentUser:{uid:'alice'}};`);
 await compile('outbox',{'../blitz/storage':'./storage','../firebase':'./firebase'});
 const storage=require(path.join(dir,'storage.js')), firebase=require(path.join(dir,'firebase.js')),outbox=require(path.join(dir,'outbox.js'));
 const attempt={id:crypto.randomUUID(),questionId:'a',version:'1',input:'2',correct:true,createdAt:new Date().toISOString()};const user={uid:'alice',getIdToken:async()=> 'test-token'};let calls=0;
 global.fetch=async()=>{calls++;return {ok:true};};
 await outbox.queuePreparationAttempt('alice',attempt);await outbox.queuePreparationAttempt('alice',attempt);assert.equal(storage.records.get('preparation-outbox:alice').length,1);
 await outbox.flushPreparationAttempts('alice',user,true);await outbox.flushPreparationAttempts('bob',user,false);assert.equal(calls,0);
 global.fetch=async()=>{calls++;return {ok:false};};assert.equal((await outbox.flushPreparationAttempts('alice',user,false)).pending,1);
 let release;global.fetch=()=>new Promise(resolve=>{release=()=>resolve({ok:true});});global.window={dispatchEvent:()=>{}};
 const syncing=outbox.flushPreparationAttempts('alice',user,false);while(!release)await new Promise(resolve=>setImmediate(resolve));await outbox.queuePreparationAttempt('alice',{...attempt,id:crypto.randomUUID()});release();assert.equal((await syncing).pending,1,'new queued attempt survives an in-flight acknowledgement');
 firebase.auth.currentUser={uid:'bob'};let forbidden=0;global.fetch=async()=>{forbidden++;return {ok:true};};await outbox.flushPreparationAttempts('alice',user,false);assert.equal(forbidden,0);
 await fs.writeFile(path.join(dir,'admin.js'),`exports.getFirebaseAdmin=()=>({adminAuth:{verifyIdToken:async token=>token==='invalid'?null:{uid:token,email:token==='teacher'?'e.galkin07@mail.ru':token+'@test.invalid'}},adminDb:{doc:path=>({get:async()=>({data:()=>({role:'student',status:path.endsWith('/blocked')?'inactive':'active'})})}),collection:()=>({where(key,op,value){if(key==='studentId')this.student=value;return this},limit(){return this},async get(){return {empty:this.student==='outsider',docs:[{get:()=>this.student==='archived'?'archived':undefined}]}}})}});`);
 await compile('access',{'import "server-only";':'','../firebase-admin':'./admin'});const access=require(path.join(dir,'access.js')).preparationAccess;
 const request=id=>new Request('https://test.invalid',{headers:id?{Authorization:'Bearer '+id}:{}});
 await assert.rejects(access(request(null)),/401/);await assert.rejects(access(request('invalid')),/401/);await assert.rejects(access(request('alice'),'bob'),/403/);await assert.rejects(access(request('blocked')),/403/);await assert.rejects(access(request('teacher'),'../other'),/400/);await assert.rejects(access(request('teacher'),'outsider'),/403/);await assert.rejects(access(request('teacher'),'archived'),/403/);assert.equal((await access(request('teacher'),'alice')).target,'alice');assert.equal((await access(request('alice'))).target,'alice');
 console.log('command center I/O checks passed: durable queue, duplicate IDs, offline retention, concurrent acknowledgement, demo/account isolation, student ownership and teacher relationship access');
}finally{await fs.rm(dir,{recursive:true,force:true});}
