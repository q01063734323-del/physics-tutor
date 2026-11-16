import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { createRequire } from "node:module";
import ts from "typescript";
import katex from "katex";

// Compile the small domain modules into an isolated temporary directory. This
// exercises the same grading helpers used by the app without a second test framework.
const directory = await fs.mkdtemp(path.join(os.tmpdir(), "physics-trainer-test-"));
try {
  for (const name of ["grading", "question-bank", "trainer-bank", "pdf-drafts"]) {
    const source = await fs.readFile(new URL(`../src/lib/${name}.ts`, import.meta.url), "utf8");
    const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } });
    await fs.writeFile(path.join(directory, `${name}.js`), compiled.outputText);
  }
  const require = createRequire(import.meta.url);
  const bank = require(path.join(directory, "trainer-bank.js"));
  const legacy = require(path.join(directory, "question-bank.js"));
  const drafts = require(path.join(directory, "pdf-drafts.js"));
  const adapted = legacy.importedQuestionBank.map(bank.adaptLegacyQuestion);
  assert.equal(adapted.length, 50);
  assert(adapted.every(bank.isStudentQuestion), "existing verified tasks must retain visibility");
  assert(adapted.every(question => question.examNumber === null), "do not invent exam numbers for legacy tasks");
  const original = { ...adapted[0], id: "private-test", version: "1", origin: "pdf", examNumber: 2, examYear: 2027,
    mapping: { status: "confirmed", evidence: "Test fixture" }, topics: ["Динамика", "Второй закон Ньютона"],
    source: { id: "a".repeat(64), title: "Original test fixture", sha256: "a".repeat(64), pdfPage: 1, taskLabel: "test", answerPage: 2 },
    rights: { status: "unknown", note: "No publishing permission" }, answer: { type: "numeric", expected: "0.25" },
    review: { status: "needs_review", conditionComplete: true, answerCheckedAgainstSource: true, figuresChecked: true, mathChecked: true, issues: [] } };
  assert.deepEqual(bank.validateTrainerQuestion(original), []);
  assert.equal(bank.canPublishQuestion(original), false);
  assert.equal(bank.canPublishQuestion({ ...original, rights: { status: "approved", note: "Permission" } }), false);
  const publishable = { ...original, rights: { status: "approved", note: "Permission" }, review: { ...original.review, status: "verified" } };
  assert.equal(bank.canPublishQuestion(publishable), true);
  assert.equal(bank.canPublishQuestion({ ...publishable, answer: null }), false);
  assert.equal(bank.canPublishQuestion({ ...publishable, review: { ...publishable.review, conditionComplete: false } }), false);
  assert.equal(bank.isStudentQuestion(original), false);
  assert.equal(bank.gradeTrainerAnswer(original, "0,250").correct, true);
  assert.equal(bank.gradeTrainerAnswer(original, "").correct, null);
  assert.equal(bank.gradeTrainerAnswer({ ...original, answer: { type: "numeric", expected: "3e-19" } }, "3e-19").correct, true);
  assert.equal(bank.gradeTrainerAnswer({ ...original, answer: { type: "sequence", expected: ["40", "25", "108"] } }, "40,0; 25; 108").correct, true);
  assert.equal(bank.gradeTrainerAnswer({ ...original, answer: { type: "sequence", expected: ["1", "2"], compact: true } }, "21").correct, false);
  assert.equal(bank.gradeTrainerAnswer({ ...original, answer: { type: "multi_select", expected: [1, 3] } }, "31").correct, true);
  assert.equal(bank.gradeTrainerAnswer({ ...original, answer: { type: "multi_select", expected: [1, 3] } }, "113").correct, false);
  const first = bank.mergeTrainerQuestions([], [original]);
  const repeated = bank.mergeTrainerQuestions(first.questions, [original]);
  assert.equal(repeated.questions.length, 1);
  assert.equal(repeated.added, 0);
  assert.equal(repeated.unchanged, 1);
  assert.equal(bank.mergeTrainerQuestions([], [{ ...original, prompt: "" }]).errors.length, 1);
  assert.equal(bank.filterTrainerQuestions([original], { ...bank.initialTrainerFilters, mode: "topics", topic: "Второй закон Ньютона" }).length, 1);
  assert.equal(bank.filterTrainerQuestions([original], { ...bank.initialTrainerFilters, number: 2 }).length, 1);
  assert.equal(bank.filterTrainerQuestions([original], { ...bank.initialTrainerFilters, number: 1 }).length, 0);
  const attempts = [{ id: "x", questionId: original.id, version: "1", input: "1", correct: false, createdAt: new Date().toISOString() }];
  assert.equal(bank.trainerProgress([original], attempts).mistakes, 1);
  assert.equal(bank.trainerProgress([{ ...original, version: "2" }], attempts).attempted, 0);
  assert.equal(bank.filterTrainerQuestions([original], { ...bank.initialTrainerFilters, progress: "new" }, attempts).length, 0);
  assert(!katex.renderToString("\\href{javascript:alert(1)}{x}", { trust: false }).includes("href="));
  console.log("trainer model tests passed: legacy compatibility, publishing gates, grading, filters, revisions and deduplication");

  const pilotFile = new URL("../.local/pdf-imports/pilot/manifest.json", import.meta.url);
  try {
    const batch = JSON.parse(await fs.readFile(pilotFile, "utf8"));
    assert(batch.questions.length >= 5 && batch.questions.length <= 10);
    assert.equal(new Set(batch.questions.map(question => question.id)).size, batch.questions.length);
    for (const question of batch.questions) {
      assert.deepEqual(bank.validateTrainerQuestion(question), []);
      assert.equal(bank.isStudentQuestion(question), false, "PDF drafts must never become student-visible");
      assert(question.source.answerPage);
      const sample = question.answer.type === "sequence" ? question.answer.expected.join(";") : question.answer.expected;
      assert.equal(bank.gradeTrainerAnswer(question, sample).correct, true);
      for (const text of [question.prompt, question.solution || ""]) {
        for (const match of text.matchAll(/\$\$([\s\S]*?)\$\$|\$([^$\n]+)\$/g)) katex.renderToString(match[1] || match[2], { throwOnError: true, strict: "error", trust: false, maxExpand: 200 });
      }
      for (const asset of question.assets) {
        const file = asset.url.split("=")[1];
        assert(/^[a-z0-9-]+\.png$/.test(file));
        const data = await fs.readFile(new URL(`../.local/pdf-imports/pilot/assets/${file}`, import.meta.url));
        assert.equal(data.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
      }
    }
    console.log(`private pilot checks passed: ${batch.questions.length} drafts, source references, images and LaTeX`);
  } catch (error) { if (error.code === "ENOENT" && error.path === pilotFile.pathname) console.log("private pilot absent: source-specific checks skipped"); else throw error; }

  try {
    const fullDirectory = new URL("../.local/pdf-imports/full/", import.meta.url);
    const full = JSON.parse(await fs.readFile(new URL("manifest.json", fullDirectory), "utf8"));
    assert.equal(full.schemaVersion, 2);
    assert.equal(full.pages, 488);
    assert(full.questions.length > 1000, "mass preparation must contain more than the pilot");
    assert.equal(new Set(full.questions.map(question => question.id)).size, full.questions.length);
    const pilotIds = full.questions.filter(question => question.pilotQuestionId).map(question => question.pilotQuestionId);
    assert.equal(pilotIds.length, 8);
    assert.equal(new Set(pilotIds).size, 8, "pilot tasks must be reused once, not duplicated");
    assert.equal(drafts.filterPdfDrafts(full.questions, { ...drafts.initialPdfDraftFilters, review: "source_checked" }).length, full.summary.sourceChecked);
    const dynamics = full.questions.find(question => question.section === "Механика" && question.sourceExamNumber === 2);
    assert(dynamics);
    assert(drafts.filterPdfDrafts([dynamics], { ...drafts.initialPdfDraftFilters, mode: "topics", number: "1", topic: dynamics.topics[0] }).length, "topic mode must ignore the previous number filter");
    assert.equal(drafts.filterPdfDrafts([dynamics], { ...drafts.initialPdfDraftFilters, number: "2", topic: "absent" }).length, 1, "number mode must ignore the previous topic filter");
    assert.equal(drafts.filterPdfDrafts(full.questions, { ...drafts.initialPdfDraftFilters, query: "no_such_task_990028881" }).length, 0);
    const assetSet = new Set(full.assets);
    const dimensions = new Map();
    for (const name of full.assets) {
      assert(/^(page-\d{3}|crop-[a-f0-9]{20})\.png$/.test(name), "asset names must not permit directory traversal");
      const file = new URL(`${name.startsWith("page-") ? "source-pages" : "assets"}/${name}`, fullDirectory);
      const handle = await fs.open(file, "r");
      const header = Buffer.alloc(24);
      try { await handle.read(header, 0, 24, 0); } finally { await handle.close(); }
      assert.equal(header.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
      dimensions.set(name, [header.readUInt32BE(16), header.readUInt32BE(20)]);
    }
    for (let n = 1; n <= full.pages; n++) assert(assetSet.has(`page-${String(n).padStart(3, "0")}.png`), "every source page must be preserved");
    for (const question of full.questions) {
      assert.equal(question.rights, "unknown");
      assert(question.review.status === "needs_review" || question.review.status === "source_checked");
      if (question.review.status !== "source_checked") { assert.equal(question.answer, null, "unverified answers must not become grading keys"); assert.equal(question.solution, null); }
      else {
        const converted = drafts.verifiedDraftToTrainer(question, full.sourceId, full.title);
        assert(converted);
        assert.deepEqual(bank.validateTrainerQuestion(converted), []);
        assert.equal(bank.isStudentQuestion(converted), false, "visual review must not grant publication rights or teacher approval");
        const input = ["numeric", "manual"].includes(question.answer.type) ? question.answer.expected : question.answer.expected.join(question.answer.compact ? "" : ";");
        assert.equal(bank.gradeTrainerAnswer(converted, input).correct, question.answer.type === "manual" ? null : true);
        for (const match of converted.prompt.matchAll(/\$\$([\s\S]*?)\$\$|\$([^$\n]+)\$/g)) katex.renderToString(match[1] || match[2], { throwOnError: true, strict: "error", trust: false });
      }
      assert(question.fragments.some(fragment => fragment.role === "condition"));
      for (const fragment of [...question.fragments, ...(question.verifiedFigures || []), ...(question.verifiedSolutionFragments || []), ...(question.solutionCandidate?.fragments || [])]) {
        assert(assetSet.has(fragment.asset));
        assert(fragment.pdfPage >= 1 && fragment.pdfPage <= 488);
        const [width, height] = dimensions.get(`page-${String(fragment.pdfPage).padStart(3, "0")}.png`);
        const [x0, y0, x1, y1] = fragment.bbox;
        assert(x0 >= 0 && y0 >= 0 && x1 <= width && y1 <= height && x1 > x0 && y1 > y0);
        assert.deepEqual(dimensions.get(fragment.asset), [x1 - x0, y1 - y0], "crop dimensions must match the recorded source region");
      }
    }
    console.log(`private full-bank checks passed: ${full.questions.length} candidates, all 488 pages, source crops, pilot reuse and no invented grading keys`);
  } catch (error) { if (error.code === "ENOENT" && error.path === new URL("../.local/pdf-imports/full/manifest.json", import.meta.url).pathname) console.log("private full bank absent: source-specific checks skipped"); else throw error; }
} finally { await fs.rm(directory, { recursive: true, force: true }); }
