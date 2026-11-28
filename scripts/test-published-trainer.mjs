import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { createRequire } from "node:module";
import ts from "typescript";

const temporary = await fs.mkdtemp(path.join(os.tmpdir(), "published-trainer-test-"));
try {
  for (const name of ["grading", "trainer-bank", "trainer-public"]) {
    const source = await fs.readFile(new URL(`../src/lib/${name}.ts`, import.meta.url), "utf8");
    await fs.writeFile(path.join(temporary, `${name}.js`), ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText);
  }
  const require = createRequire(import.meta.url);
  const { canPublishQuestion, validateTrainerQuestion } = require(path.join(temporary, "trainer-bank.js"));
  const { publicTrainerQuestion, checkPublishedAnswer, trainerOriginAllowed } = require(path.join(temporary, "trainer-public.js"));
  const publicUrl = "https://physics-tutor-6ytz.onrender.com";
  const internalUrl = "http://0.0.0.0:10000/api/trainer";
  assert.equal(trainerOriginAllowed(publicUrl, internalUrl, publicUrl), true, "Render proxy must accept its public site");
  assert.equal(trainerOriginAllowed("http://localhost:3218", "http://localhost:3218/api/trainer", publicUrl), true);
  assert.equal(trainerOriginAllowed("http://127.0.0.1:3223", "http://localhost:3223/api/royale", publicUrl), true);
  assert.equal(trainerOriginAllowed("http://localhost:3223", "http://127.0.0.1:3223/api/royale", publicUrl), true);
  for (const origin of ["http://localhost:3224", "https://localhost:3223", "http://localhost.evil:3223", "http://192.168.1.5:3223"]) assert.equal(trainerOriginAllowed(origin, "http://localhost:3223/api/royale", publicUrl), false);
  assert.equal(trainerOriginAllowed(null, internalUrl, publicUrl), true);
  for (const origin of ["https://example.com", "https://physics-tutor-6ytz.onrender.com.evil.example", "http://physics-tutor-6ytz.onrender.com", "null"]) assert.equal(trainerOriginAllowed(origin, internalUrl, publicUrl), false);
  assert.equal(trainerOriginAllowed("https://example.com", internalUrl, "invalid"), false);
  const bank = JSON.parse(await fs.readFile(new URL("../data/trainer/public-original.json", import.meta.url), "utf8"));
  const historical = JSON.parse(await fs.readFile(new URL("../data/trainer/legacy-attempt-index.json", import.meta.url), "utf8"));
  assert.equal(bank.questions.length, 288);
  assert.equal(new Set(bank.questions.map(q => q.id)).size, bank.questions.length);
  assert.equal(new Set(bank.questions.map(q => q.prompt)).size, bank.questions.length);
  assert.equal(historical.length, 1460);
  assert(historical.every(task => Object.keys(task).sort().join(",") === "examNumber,id,section,topics,version"));
  await assert.rejects(fs.access(new URL("../public/trainer-assets/physics-2026", import.meta.url)), { code: "ENOENT" });
  for (const question of bank.questions) {
    assert.equal(question.origin, "original");
    assert.equal(question.assets.length, 0);
    assert.equal(question.examNumber, null);
    assert(canPublishQuestion(question));
    assert.deepEqual(validateTrainerQuestion(question), []);
    const visible = publicTrainerQuestion(question);
    assert.equal(visible.solution, null);
    assert.equal(visible.searchText, undefined);
    assert(visible.answer.expected === "" || visible.answer.expected.length === 0);
    const expected = question.answer.type === "numeric" ? question.answer.expected : question.answer.expected.join(";");
    assert.equal(checkPublishedAnswer(question, expected).correct, true, question.id);
    assert.equal(checkPublishedAnswer(question, "9999000").correct, false, question.id);
  }
  console.log("Published trainer: 288 distinct original tasks, validated keys, no solution leakage or archived images; historical index has metadata only.");
} finally { await fs.rm(temporary, { recursive: true, force: true }); }
