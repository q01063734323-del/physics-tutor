import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { validateTrainerQuestion, type TrainerQuestion } from "./trainer-bank";
import type { PdfDraftBank } from "./pdf-drafts";

export type PdfPilotBatch = {
  manifestVersion: 1;
  sourceId: string;
  title: string;
  questions: TrainerQuestion[];
  summary: { processed: number; rejected: number; duplicateCount: number; warnings: string[] };
};

export function isPdfPreviewEnabled() {
  return process.env.NODE_ENV === "development" && process.env.PDF_IMPORT_PREVIEW === "1";
}

export const pdfPilotDirectory = () => path.resolve(process.cwd(), ".local/pdf-imports/pilot");

export async function loadPdfPilot(): Promise<PdfPilotBatch> {
  if (!isPdfPreviewEnabled()) throw new Error("Private preview is disabled");
  const file = await readFile(path.join(pdfPilotDirectory(), "manifest.json"), "utf8");
  const batch = JSON.parse(file) as PdfPilotBatch;
  if (batch.manifestVersion !== 1 || !/^[a-f0-9]{64}$/.test(batch.sourceId) || !Array.isArray(batch.questions) || batch.questions.length > 10 || !batch.summary) throw new Error("Invalid pilot manifest");
  for (const question of batch.questions) {
    if (validateTrainerQuestion(question).length || question.origin !== "pdf" || question.rights.status !== "unknown" || question.review.status !== "needs_review") throw new Error("Pilot must remain an unpublished draft");
  }
  return batch;
}

export async function loadPdfPilotAsset(name: string) {
  if (!/^[a-z0-9-]+\.png$/.test(name)) return null;
  const batch = await loadPdfPilot();
  const allowed = batch.questions.flatMap(question => question.assets).some(asset => asset.url === `/api/pdf-import-preview?asset=${name}`);
  if (!allowed) return null;
  return readFile(path.join(pdfPilotDirectory(), "assets", name));
}

export async function loadFullPdfDrafts(): Promise<PdfDraftBank> {
  if (!isPdfPreviewEnabled()) throw new Error("Private preview is disabled");
  const file = await readFile(path.resolve(process.cwd(), ".local/pdf-imports/full/manifest.json"), "utf8");
  const batch = JSON.parse(file) as PdfDraftBank;
  if (batch.schemaVersion !== 2 || !/^[a-f0-9]{64}$/.test(batch.sourceId) || !Number.isInteger(batch.pages) || batch.pages < 1 || batch.pages > 2000 || !Array.isArray(batch.questions) || batch.questions.length > 5000 || !Array.isArray(batch.assets)) throw new Error("Invalid private bank");
  if (batch.questions.some(question => question.rights !== "unknown" || !["needs_review", "source_checked"].includes(question.review.status))) throw new Error("Private bank must remain unpublished");
  return batch;
}

export async function loadFullPdfAsset(name: string) {
  if (!/^(?:page-\d{3}|crop-[a-f0-9]{20})\.png$/.test(name)) return null;
  const batch = await loadFullPdfDrafts();
  if (!batch.assets.includes(name)) return null;
  const folder = name.startsWith("page-") ? "source-pages" : "assets";
  return readFile(path.resolve(process.cwd(), ".local/pdf-imports/full", folder, name));
}
