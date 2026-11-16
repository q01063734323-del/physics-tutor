import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { createRequire } from "node:module";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

// Offline content processing only. Network is used by Tesseract solely to
// download language models on first use; page images never leave this machine.
const run = promisify(execFile);
const require = createRequire(import.meta.url);
const [source, directory, startArg = "1", endArg, concurrencyArg = "3"] = process.argv.slice(2);
if (!source || !directory) throw new Error("Usage: node scripts/pdf/ocr-pdf.mjs PDF PRIVATE_OUTPUT [START] [END] [WORKERS]");
const output = path.resolve(directory);
if (output.startsWith(path.resolve("public") + path.sep)) throw new Error("OCR output must be private, outside public/");
await fs.mkdir(output, { recursive: true });
const sourceHash = crypto.createHash("sha256").update(await fs.readFile(source)).digest("hex");
const identity = path.join(output, "source.json");
try {
  const previous = JSON.parse(await fs.readFile(identity, "utf8"));
  if (previous.sha256 !== sourceHash) throw new Error("Output belongs to another PDF. Use a new directory.");
} catch (error) { if (error.code !== "ENOENT") throw error; }
const { stdout: info } = await run("pdfinfo", [source]);
const total = Number(info.match(/^Pages:\s+(\d+)/m)?.[1]);
const start = Number(startArg), end = Math.min(Number(endArg || total), total);
if (!Number.isInteger(start) || !Number.isInteger(end) || start < 1 || end < start) throw new Error("Invalid page range");
await fs.writeFile(identity, JSON.stringify({ sha256: sourceHash, pages: total, filename: path.basename(source), engine: "tesseract.js", languages: ["rus", "eng"] }, null, 2));
const { createWorker } = require(process.env.TESSERACT_MODULE || "tesseract.js");
let next = start;
async function recognizePages() {
  const localModels = await Promise.all(["rus", "eng"].map(language => fs.access(path.join(output, `${language}.traineddata`)).then(() => true, () => false)));
  const worker = await createWorker(["rus", "eng"], 1, {
    cachePath: output,
    ...(localModels.every(Boolean) ? { langPath: output, gzip: false } : {}),
  });
  try {
    while (next <= end) {
      const page = next++;
      const stem = `page-${String(page).padStart(3, "0")}`;
      const jsonFile = path.join(output, `${stem}.json`);
      try { await fs.access(jsonFile); continue; } catch {}
      const prefix = path.join(output, stem);
      const png = `${prefix}.png`;
      try {
        await run("pdftoppm", ["-f", String(page), "-l", String(page), "-singlefile", "-scale-to", "1800", "-png", source, prefix]);
        const { data } = await worker.recognize(png, {}, { text: true, tsv: true, blocks: true });
        const result = { pdfPage: page, sourceHash, confidence: data.confidence, text: data.text, tsv: data.tsv, blocks: data.blocks, requiresReview: true };
        const temporary = `${jsonFile}.tmp`;
        await fs.writeFile(temporary, JSON.stringify(result));
        await fs.rename(temporary, jsonFile);
        await fs.rm(png);
        console.log(`OCR ${page}/${total}; confidence ${Math.round(data.confidence)}; saved`);
      } catch (error) {
        await fs.writeFile(path.join(output, `${stem}.error.json`), JSON.stringify({ page, error: String(error) }));
        console.error(`OCR ${page}: ${String(error)}`);
      }
    }
  } finally { await worker.terminate(); }
}
await Promise.all(Array.from({ length: Math.max(1, Math.min(4, Number(concurrencyArg) || 1)) }, recognizePages));
