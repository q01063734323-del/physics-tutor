import assert from 'node:assert/strict';
import ts from 'typescript';
import { readFile } from 'node:fs/promises';
const source = await readFile('src/lib/command-center/analytics.ts','utf8');
const exports = {};new Function('exports',ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(exports);
const tasks = [{id:'a',version:'1',section:'Механика',topics:['Динамика'],examNumber:2},{id:'b',version:'1',section:'Механика',topics:['Динамика'],examNumber:2}];
const attempt = {id:'one',taskId:'a',taskVersion:'1',submittedAt:'2026-11-19T12:00:00Z',evaluationStatus:'evaluated',correct:false,answer:'2',source:'server'};
const list = [attempt,{...attempt,id:'two',correct:true},{...attempt,id:'pending',evaluationStatus:'pending',correct:null},{...attempt,id:'missing',taskId:'missing'},attempt];
const result=exports.summarizeAttempts(tasks,list,0,Date.parse('2026-11-20'));
assert.equal(result.attemptsCount,2);assert.equal(result.uniqueAttempted,1);assert.equal(result.uniqueSolved,1);assert.equal(result.accuracy,50);assert.equal(result.coverage,50);assert.equal(result.firstAccuracy,0);assert.equal(result.mastery,'insufficient');
assert.equal(exports.summarizeAttempts(tasks,[]).accuracy,null);assert.equal(exports.topicAnalytics(tasks,list)[0].available,2);assert.equal(exports.numberAnalytics(tasks,list)[0].number,2);assert(exports.validTarget(0));assert(exports.validTarget(100));assert(!exports.validTarget(101));assert(!exports.validTarget('90'));
console.log('command center foundation checks passed');

assert(exports.validPreparationProfile({targetScore:90,examYear:2027,examDate:"2027-06-01"}));assert(!exports.validPreparationProfile({targetScore:90,examYear:2027,examDate:"2027-02-31"}));assert(!exports.validPreparationProfile({targetScore:90,examYear:2027,examDate:"2026-06-01"}));assert.equal(exports.studyDay("2026-11-19T22:00:00Z"),"2026-11-20");assert(exports.preparationRecommendations(tasks,list,["Динамика"],Date.parse("2026-11-20"))[0].reasons.some(reason=>reason.includes("преподавателем")));

const observations=[{id:'x',examYear:2027,variant:'A',status:'reviewed',primaryScore:20,maxPrimary:40,testScore:60,completedAt:'2026-11-01',gradingSource:'Teacher verified source',fullFormat:true,recordedBy:'teacher'},{id:'y',examYear:2027,variant:'B',status:'pending',primaryScore:20,maxPrimary:40,testScore:90,completedAt:'2026-11-02',gradingSource:'source',fullFormat:true,recordedBy:'teacher'}];assert.equal(exports.observedExamRange(observations,2027).last.testScore,60);assert.equal(exports.observedExamRange(observations,2027).range,null);assert.equal(exports.observedExamRange(observations,2026).count,0);assert.deepEqual(exports.observedExamRange([...observations,{...observations[0],id:'z',testScore:70,completedAt:'2026-11-03'}],2027).range,[60,70]);

const retryLater={...attempt,id:"later",correct:true,submittedAt:"2026-11-20T12:00:00Z"};
const later=exports.summarizeAttempts(tasks,[attempt,retryLater],Date.parse("2026-11-20"),Date.parse("2026-11-21"));
assert.equal(later.accuracy,100);assert.equal(later.firstAccuracy,0);assert.equal(later.uniqueAttempted,1);
