import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { createRequire } from "node:module";
import ts from "typescript";
import katex from "katex";

const root = await fs.mkdtemp(path.join(os.tmpdir(), "physics-blitz-test-"));
try {
  const directory = path.join(root, "src/lib/blitz");
  await fs.mkdir(directory, { recursive: true });
  await fs.mkdir(path.join(root, "data/blitz"), { recursive: true });
  await fs.copyFile(new URL("../data/blitz/catalog.json", import.meta.url), path.join(root, "data/blitz/catalog.json"));
  for (const name of ["catalog", "questions", "engine", "sync"]) {
    const source = await fs.readFile(new URL(`../src/lib/blitz/${name}.ts`, import.meta.url), "utf8");
    await fs.writeFile(path.join(directory, name + ".js"), ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText);
  }
  // Only external I/O is replaced: real domain rules, queueing and sync code run below.
  await fs.writeFile(path.join(root, "src/lib/firebase.js"), "exports.db = {};\n");
  await fs.writeFile(path.join(directory, "storage.js"), `const records=new Map();exports.records=records;exports.readLocalRecord=async(k,f)=>structuredClone(records.get(k)??f);exports.writeLocalRecord=async(k,v)=>{records.set(k,structuredClone(v))};`);
  const mock = path.join(root, "node_modules/firebase"); await fs.mkdir(mock, { recursive: true });
  await fs.writeFile(path.join(mock, "firestore.js"), `
    const docs=new Map();const calls={create:0,read:0};exports.docs=docs;exports.calls=calls;
    exports.doc=(db,c,id)=>({path:c+'/'+id});exports.collection=(db,c)=>c;exports.where=(...args)=>args;exports.query=(...args)=>args;
    exports.serverTimestamp=()=>({seconds:1});
    exports.setDoc=async(ref,data)=>{calls.create++;if(docs.has(ref.path))throw Error('permission-denied: updates forbidden');docs.set(ref.path,structuredClone(data))};
    exports.getDoc=async(ref)=>{calls.read++;if(!docs.has(ref.path))throw Error('permission-denied: missing resource');return {exists:()=>true,data:()=>docs.get(ref.path)}};
    exports.getDocs=async()=>({docs:[...docs.values()].map(value=>({data:()=>value}))});
  `);
  const require = createRequire(import.meta.url);
  const catalog = require(path.join(directory, "catalog.js"));
  const questions = require(path.join(directory, "questions.js"));
  const engine = require(path.join(directory, "engine.js"));
  const sync = require(path.join(directory, "sync.js"));
  const firestore = require(path.join(mock, "firestore.js"));
  const storage = require(path.join(directory, "storage.js"));
  const allIds = new Set(catalog.formulas.map(formula => formula.id));
  assert.equal(allIds.size, catalog.formulas.length);
  assert.equal(catalog.codifier.elements.length, 127);
  assert.equal(catalog.formulas.length, 310);
  assert.equal(catalog.quantities.length, 57);
  const quantityIds = new Set(catalog.quantities.map(quantity => quantity.id));
  assert.equal(quantityIds.size, 57);
  for (const element of catalog.codifier.elements) {
    assert(catalog.formulas.some(formula => formula.code === element.code) || catalog.concepts.some(concept => concept.code === element.code), element.code);
    for (const id of element.requiredFormulas) assert(allIds.has(id), `${element.code}: missing required ${id}`);
  }
  const render = latex => katex.renderToString(latex, { throwOnError: true, strict: "error", trust: false, maxExpand: 200 });
  for (const formula of catalog.formulas) {
    assert(formula.title && formula.conditions && formula.variables.length && formula.section && formula.topic);
    assert.equal(formula.source.url, catalog.codifier.archiveUrl);
    assert(formula.source.printedPage >= 4 && formula.source.printedPage <= 19);
    render(formula.latex);
    for (const variable of formula.variables) { assert(quantityIds.has(variable.quantityId)); assert(variable.name && variable.unit); render(variable.symbol); }
    for (const related of formula.related) assert(allIds.has(related));
  }
  for (const quantity of catalog.quantities) { assert(quantity.name && quantity.unit && quantity.mistake); assert.equal(quantity.dimension.length, 7); render(catalog.baseLatex(quantity.baseSI)); render(catalog.dimensionLatex(quantity.dimension)); }
  const expectedDimensions = {
    force: [1,1,-2,0,0,0,0], energy: [1,2,-2,0,0,0,0], power: [1,2,-3,0,0,0,0], pressure: [1,-1,-2,0,0,0,0], density: [1,-3,0,0,0,0,0],
    charge: [0,0,1,1,0,0,0], voltage: [1,2,-3,-1,0,0,0], resistance: [1,2,-3,-2,0,0,0], capacitance: [-1,-2,4,2,0,0,0], inductance: [1,2,-2,-2,0,0,0],
    "magnetic-flux": [1,2,-2,-1,0,0,0], "magnetic-induction": [1,0,-2,-1,0,0,0], "specific-heat": [0,2,-2,0,-1,0,0], "molar-mass": [1,0,0,0,0,-1,0],
  };
  for (const [id, dimension] of Object.entries(expectedDimensions)) assert.deepEqual(catalog.quantityById.get(id).dimension, dimension, id);
  assert.equal(catalog.formulaById.get("kelvin").provided, true);
  assert.equal(catalog.formulaById.get("newton-second").provided, false);
  assert.match(catalog.formulaById.get("carnot").conditions, /кельвин/);
  assert.match(catalog.formulaById.get("grating").conditions, /Нормальное/);
  assert.match(catalog.formulaById.get("kinetic").latex, /2/);
  const questionIds = new Set(questions.allQuestions.map(question => question.id));
  assert.equal(questionIds.size, questions.allQuestions.length);
  for (const question of questions.allQuestions) {
    assert.equal(question.choices.length, 4, question.id); assert.equal(new Set(question.choices).size, 4, question.id); assert(question.choices.includes(question.correct));
    assert(question.prompt && question.explanation && question.learningId && question.sections.length && question.topics.length);
    for (const text of [question.prompt, question.context, ...question.choices, question.explanation]) for (const match of text.matchAll(/\$([^$]+)\$/g)) render(match[1]);
  }
  assert.equal(questions.questionById.get("conversion:speed-72").correct, "20");
  assert.equal(questions.questionById.get("conversion:density-cgs").correct, "1000");
  assert.equal(questions.questionById.get("conversion:cm-square").correct, "0,0005");
  assert.equal(questions.questionById.get("conversion:cm-cube").correct, "0,000002");
  assert.equal(questions.questionById.get("conversion:temp-room").correct, "300");
  assert.equal(questions.questionById.get("conversion:temp-back").correct, "0");
  assert.equal(questions.questionById.get("conversion:temp-difference").correct, "20");
  assert.equal(questions.questionById.get("conversion:mass-mg").correct, "0,000005");
  assert.equal(questions.questionById.get("conversion:energy-ev").correct, "8e-19");
  const now = Date.parse("2026-11-18T12:00:00Z");
  let state = engine.emptyStudyState();
  for (const mode of ["classic", "guess", "assemble", "unknown", "units", "traps", "flash", "exam", "timed"]) {
    const settings = { ...questions.defaultSettings, mode, count: "all" };
    const pool = questions.filterQuestions(settings);
    assert(pool.length > 0, mode);
    const session = engine.createSession(state, settings, now, 42, "session-" + mode);
    assert.equal(new Set(session.questionIds).size, session.questionIds.length, mode);
    assert.equal(session.questionIds.length, pool.length);
    assert.deepEqual(session.questionIds, engine.createSession(state, settings, now, 42, "repeat").questionIds);
  }
  const optics = questions.filterQuestions({ ...questions.defaultSettings, sections: ["Оптика"], content: "formulas", difficulty: 3 });
  assert(optics.length && optics.every(q => q.sections.includes("Оптика") && q.difficulty === 3 && q.kind !== "unit"));
  const unknownPool = questions.filterQuestions({ ...questions.defaultSettings, mode: "unknown" });
  const unknownSession = engine.createSession(state, { ...questions.defaultSettings, mode: "unknown", count: 100 }, now, 1, "small");
  assert.equal(unknownSession.questionIds.length, unknownPool.length); assert(unknownPool.length < 100);
  state.active = engine.createSession(state, { ...questions.defaultSettings, count: 2 }, now, 42, "main");
  assert.equal(engine.nextQuestion(state, now), state, "cannot silently skip an unanswered question");
  const first = questions.questionById.get(state.active.questionIds[0]);
  assert.equal(engine.answerSession(state, "anything", now, true), state, "self-rating only belongs to flashcards");
  const wrong = first.choices.find(choice => choice !== first.correct);
  state = engine.answerSession(state, wrong, now + 1000);
  assert.equal(state.events.length, 1);
  assert.equal(engine.answerSession(state, first.correct, now + 2000), state, "double click must not add a second review");
  assert(engine.mistakeIds(state.events).includes(first.id));
  const mistakesPool = questions.filterQuestions({ ...questions.defaultSettings, mode: "mistakes" }, engine.mistakeIds(state.events));
  assert.equal(mistakesPool.length, 1);
  state = engine.nextQuestion(state, now + 3000);
  const second = questions.questionById.get(state.active.questionIds[1]);
  state = engine.answerSession(state, second.correct, now + 4000);
  state = engine.nextQuestion(state, now + 5000);
  assert.equal(state.active, null); assert.equal(state.history.length, 1); assert.equal(state.pending.length, 1); assert.equal(state.history[0].correct, 1);
  const roundTrip = JSON.parse(JSON.stringify(state)); assert.deepEqual(roundTrip, state);
  const combined = engine.mergeCloudResults(state, [state.history[0], state.history[0]]);
  assert.equal(combined.events.length, 2); assert.equal(combined.history.length, 1); assert.equal(combined.pending.length, 0);
  const reviews = [false, true, true, true].map((correct, index) => ({ id: `spaced-${index}`, sessionId: "spaced", questionId: first.id, learningId: first.learningId, selected: "x", selfRated: false, correct, at: new Date(now + index * 86400000).toISOString() }));
  const learned = engine.masteryFor(reviews)[first.learningId]; assert.equal(learned.attempts, 4); assert.equal(learned.errors, 1); assert.equal(learned.level, 3);
  assert.equal(Date.parse(learned.nextDue) - Date.parse(learned.lastSeen), 7 * 86400000);
  const forgotten = engine.masteryFor([...reviews, { ...reviews[0], id: "miss-again", at: new Date(now + 4 * 86400000).toISOString() }])[first.learningId];
  assert.equal(forgotten.level, 0); assert.equal(Date.parse(forgotten.nextDue) - Date.parse(forgotten.lastSeen), 600000);
  assert.equal(engine.dayStreak(reviews.slice(0, 3), now + 2 * 86400000), 3);
  let timed = engine.emptyStudyState(); timed.active = engine.createSession(timed, { ...questions.defaultSettings, mode: "timed" }, now, 3, "timed");
  assert.equal(engine.answerSession(timed, questions.questionById.get(timed.active.questionIds[0]).correct, now + 90000), timed);
  timed = engine.finishSession(timed, now + 5 * 86400000);
  assert.equal(timed.history[0].duration, 90); assert.equal(timed.history[0].correct, 0); assert.equal(timed.pending.length, 1, "a completed zero-score timer still persists");
  const exam = engine.createSession(engine.emptyStudyState(), { ...questions.defaultSettings, mode: "exam", count: 10 }, now, 22, "exam");
  assert(catalog.sections.every(section => exam.questionIds.some(id => questions.questionById.get(id).sections.includes(section))), "exam balances all selected sections");
  let calls = 0;
  const forbidden = { read: async () => { calls++; return []; }, send: async () => { calls++; } };
  await sync.flushLearningResults(state.pending, false, forbidden); assert.equal(calls, 0);
  assert.equal(sync.canSyncLearning("guest", null, false), false);
  assert.equal(sync.canSyncLearning("student-a", { uid: "student-a", email: "a@example.com" }, true), false);
  assert.equal(sync.canSyncLearning("student-b", { uid: "student-a", email: "a@example.com" }, false), false);
  const failure = await sync.flushLearningResults(state.pending, true, { read: async () => [], send: async () => { throw Error("offline"); } });
  assert.equal(failure.acknowledged.length, 0); assert.equal(failure.failed.length, 1); assert.equal(state.pending.length, 1);
  const user = { uid: "student-a", email: "a@example.com" };
  const transport = sync.firebaseLearningTransport(user);
  await transport.send(state.history[0]); await transport.send(state.history[0]);
  assert.equal(firestore.docs.size, 1, "retry cannot create duplicate cloud results"); assert.equal(firestore.calls.read, 1, "only read the existing resource after create/update failed");
  const restored = await transport.read(); assert.equal(restored.length, 1);
  const acknowledged = await sync.flushLearningResults(state.pending, true, transport); assert.equal(acknowledged.remote.length, 1); assert.equal(acknowledged.failed.length, 0);
  const legacy = { id: "legacy-a", kind: "exam-v2", score: 2, total: 12, mode: "ЕГЭ", answers: { 1: "100" }, finishedAt: new Date(now).toISOString() };
  await Promise.all([sync.queueExamResult(user.uid, legacy), sync.queueExamResult(user.uid, { ...legacy, id: "legacy-b" })]);
  await sync.queueExamResult(user.uid, legacy);
  assert.equal(storage.records.get("exam-outbox:student-a").length, 2);
  const before = firestore.calls.create; await sync.syncExamResults("guest", user, true); assert.equal(firestore.calls.create, before);
  const synced = await sync.syncExamResults(user.uid, user, false); assert.equal(synced.pending, 0);
  assert(storage.records.get("exam-outbox:student-a").every(record => record.synced));
  console.log(`blitz checks passed: ${catalog.formulas.length} formulas; ${catalog.quantities.length} SI quantities; ${questions.allQuestions.length} unique questions; 127 FIPI codes; KaTeX; dimensions; conversions; modes and filters; no repeats; timer; spaced repetition; progress replay; durable queue; guest isolation; idempotent cloud retries`);
} finally { await fs.rm(root, { recursive: true, force: true }); }
