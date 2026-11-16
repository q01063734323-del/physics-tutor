import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { isPdfPreviewEnabled, loadPdfPilot, loadFullPdfDrafts } from "@/lib/pdf-preview-server";
import PdfImportPreview from "@/components/PdfImportPreview";

export const metadata = { title: "Черновой импорт PDF · Физика с Егором", robots: { index: false, follow: false } };

async function PrivatePreview() {
  await connection();
  const batch = await loadPdfPilot().catch(() => null);
  const full = await loadFullPdfDrafts().catch(() => null);
  if (!batch) return <main style={{ maxWidth: 700, margin: "80px auto", padding: 24 }}><h1>Черновой набор пока недоступен</h1><p>Сначала подготовьте локальный пилотный импорт по инструкции в docs/PDF-TRAINER.md.</p><Link href="/teacher">Вернуться в кабинет</Link></main>;
  return <PdfImportPreview batch={batch} full={full} />;
}

export default function PdfPreviewPage() {
  if (!isPdfPreviewEnabled()) notFound();
  return <Suspense fallback={<main style={{ padding: 40 }}>Загружаем локальный черновик…</main>}><PrivatePreview /></Suspense>;
}
