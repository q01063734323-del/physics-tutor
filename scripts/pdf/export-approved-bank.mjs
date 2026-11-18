import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";
import ts from "typescript";

// Explicit publication step; the private manifests and review ledger stay intact.
if (!process.argv.includes("--confirm-publication")) throw new Error("Publication confirmation is required");
const root = process.cwd();
const temporary = await fs.mkdtemp(path.join(os.tmpdir(), "physics-bank-export-"));
try {
  for (const name of ["grading", "trainer-bank", "pdf-drafts"]) {
    const source = await fs.readFile(path.join(root, "src/lib", `${name}.ts`), "utf8");
    await fs.writeFile(path.join(temporary, `${name}.js`), ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText);
  }
  const require = createRequire(import.meta.url);
  const { verifiedDraftToTrainer } = require(path.join(temporary, "pdf-drafts.js"));
  const { validateTrainerQuestion, canPublishQuestion } = require(path.join(temporary, "trainer-bank.js"));
  const full = JSON.parse(await fs.readFile(".local/pdf-imports/full/manifest.json", "utf8"));
  const pilot = JSON.parse(await fs.readFile(".local/pdf-imports/pilot/manifest.json", "utf8"));
  const images = new Map();
  const targetDirectory = path.join(root, "public/trainer-assets/physics-2026");
  await fs.mkdir(targetDirectory, { recursive: true });
  const questions = [];
  for (const draft of full.questions) {
    if (draft.review.status !== "source_checked") continue;
    const original = pilot.questions.find(q => q.id === draft.pilotQuestionId) || verifiedDraftToTrainer(draft, full.sourceId, full.title);
    if (!original) throw new Error(`Incomplete checked exercise: ${draft.id}`);
    const question = structuredClone(original);
    question.id = draft.id;
    question.version = draft.version;
    question.searchText = undefined;
    question.examYear = 2026;
    question.mapping.evidence = question.examNumber ? "Печатная метка из сборника ЕГЭ-2026, сверенная с оригиналом." : "Подтверждённой печатной метки ЕГЭ в источнике нет.";
    const fromPilot = Boolean(draft.pilotQuestionId);
    question.assets = question.assets.filter(a => !["condition", "answer"].includes(a.role)).map(asset => {
      const name = new URL(asset.url, "http://localhost").searchParams.get("asset");
      if (!name || !/^(crop|asset)-[a-f0-9]+\.png$/.test(name)) throw new Error("Unexpected source fragment");
      const source = path.join(root, ".local/pdf-imports", fromPilot ? "pilot" : "full", "assets", name);
      const target = `${name.replace(/\.png$/, "")}.webp`;
      images.set(source, path.join(targetDirectory, target));
      return { ...asset, url: `/trainer-assets/physics-2026/${target}` };
    });
    // Owner confirmation is recorded accurately; it is not an open licence claim.
    question.rights = { status: "approved", note: "Размещение выбранного набора подтверждено владельцем проекта в чате 18.11.2026. Открытая лицензия не установлена.", evidence: "owner-confirmation-2026-11-18" };
    question.review = { ...question.review, status: "verified", issues: [] };
    if (validateTrainerQuestion(question).length || !canPublishQuestion(question)) throw new Error(`Invalid publication candidate: ${draft.id}`);
    questions.push(question);
  }
  if (questions.length !== 1460 || new Set(questions.map(q => q.id)).size !== 1460) throw new Error("Unexpected approved bank size or duplicate IDs");
  const plan = path.join(temporary, "images.json");
  const result = path.join(temporary, "verified.json");
  await fs.writeFile(plan, JSON.stringify([...images]));
  const encoded = spawnSync(process.env.PDF_IMAGE_PYTHON || "python3", ["scripts/pdf/encode-published-assets.py", plan, result], { stdio: "inherit" });
  if (encoded.status !== 0) throw new Error("Image verification failed");
  const assets = JSON.parse(await fs.readFile(result, "utf8"));
  const version = createHash("sha256").update(JSON.stringify(questions)).digest("hex").slice(0, 16);
  await fs.mkdir("data/trainer", { recursive: true });
  await fs.writeFile("data/trainer/physics-2026.json", JSON.stringify({ schemaVersion: 1, version, sourceId: full.sourceId, title: full.title, approvedAt: "2026-11-18", excluded: full.questions.length - questions.length, questions }) + "\n");
  await fs.writeFile("data/trainer/assets.json", JSON.stringify({ version, assets }, null, 2) + "\n");
  console.log(`Approved bank exported: ${questions.length} exercises, ${assets.length} pixel-exact images, ${Math.round(assets.reduce((sum, a) => sum + a.bytes, 0) / 1024 / 1024)} MiB; ${full.questions.length - questions.length} excluded.`);
} finally {
  await fs.rm(temporary, { recursive: true, force: true });
}
