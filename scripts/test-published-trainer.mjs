import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { createRequire } from "node:module";
import { createHash } from "node:crypto";
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
  const bank = JSON.parse(await fs.readFile(new URL("../data/trainer/physics-2026.json", import.meta.url), "utf8"));
  const assets = JSON.parse(await fs.readFile(new URL("../data/trainer/assets.json", import.meta.url), "utf8"));
  assert.equal(bank.questions.length, 1460);
  assert.equal(bank.excluded, 21);
  assert.equal(new Set(bank.questions.map(q => q.id)).size, 1460);
  const referenced = new Set();
  for (const question of bank.questions) {
    assert(canPublishQuestion(question));
    assert.deepEqual(validateTrainerQuestion(question), []);
    assert.equal(question.searchText, undefined, "do not export unreviewed OCR columns");
    const visible = publicTrainerQuestion(question);
    assert.equal(visible.solution, null);
    assert.equal(visible.searchText, undefined);
    assert(visible.assets.every(asset => !["solution", "answer", "condition"].includes(asset.role)));
    assert(!visible.answer || (visible.answer.type === "manual" ? visible.answer.expected === undefined : Array.isArray(visible.answer.expected) ? visible.answer.expected.length === 0 : visible.answer.expected === ""));
    if (question.answer.type !== "manual") {
      const expected = question.answer.type === "numeric" ? question.answer.expected : question.answer.expected.join(";");
      const result = checkPublishedAnswer(question, expected);
      assert.equal(result.correct, true, question.id);
      assert.deepEqual(result.answer, question.answer);
      assert(result.assets.every(asset => asset.role === "solution"));
    }
    for (const asset of question.assets) {
      assert.match(asset.url, /^\/trainer-assets\/physics-2026\/(crop|asset)-[a-f0-9]+\.webp$/);
      referenced.add(path.basename(asset.url));
    }
  }
  assert.equal(referenced.size, assets.assets.length);
  for (const asset of assets.assets) {
    assert(referenced.has(asset.file));
    const bytes = await fs.readFile(new URL(`../public/trainer-assets/physics-2026/${asset.file}`, import.meta.url));
    assert.equal(bytes.subarray(8, 12).toString(), "WEBP");
    assert.equal(createHash("sha256").update(bytes).digest("hex"), asset.sha256);
  }
  console.log(`published trainer checks passed: 1460 unique approved records, 21 excluded, ${referenced.size} verified images; no keys or solutions in the catalog; all automatic answer keys accepted`);
} finally { await fs.rm(temporary, { recursive: true, force: true }); }
