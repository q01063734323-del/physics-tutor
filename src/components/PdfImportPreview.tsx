"use client";

import { useState } from "react";
import Link from "next/link";
import type { PdfPilotBatch } from "@/lib/pdf-preview-server";
import { verifiedDraftToTrainer, type PdfDraftBank } from "@/lib/pdf-drafts";
import { importedQuestionBank } from "@/lib/question-bank";
import { adaptLegacyQuestion } from "@/lib/trainer-bank";
import QuestionTrainer from "./QuestionTrainer";
import PdfBankReview from "./PdfBankReview";
import styles from "./QuestionTrainer.module.css";

export default function PdfImportPreview({ batch, full }: { batch: PdfPilotBatch; full?: PdfDraftBank | null }) {
  const [dataset, setDataset] = useState(full ? "full" : "pilot");
  const checkedQuestions = full ? full.questions.flatMap(question => {
    if (question.review.status !== "source_checked") return [];
    const pilot = batch.questions.find(item => item.id === question.pilotQuestionId);
    const converted = pilot || verifiedDraftToTrainer(question, full.sourceId, full.title);
    return converted ? [converted] : [];
  }) : batch.questions;
  const questions = dataset === "pilot" ? batch.questions : dataset === "checked" ? checkedQuestions : importedQuestionBank.map(adaptLegacyQuestion);
  const fullReport = Boolean(full && (dataset === "full" || dataset === "checked"));
  return <>
    <nav className={styles.previewNav} aria-label="Предпросмотр импорта"><Link href="/teacher">← Физика с Егором</Link><label>Набор задач<select value={dataset} onChange={event => setDataset(event.target.value)}>{full && <><option value="full">Банк PDF · {full.questions.length}</option><option value="checked">Практика · проверено {checkedQuestions.length}</option></>}<option value="pilot">Исходный пилот · {batch.questions.length}</option><option value="existing">Существующие задачи · {importedQuestionBank.length}</option></select></label><span>Без записи в Firebase</span></nav>
    {dataset === "full" && full ? <PdfBankReview bank={full} /> : <QuestionTrainer key={dataset} questions={questions} namespace={`pdf-preview:${batch.sourceId}:${dataset}`} preview />}
    <section className={styles.importReport} aria-label="Результат импорта"><h2>{fullReport ? "Отчёт подготовки банка" : "Отчёт пилотного импорта"}</h2><p>{batch.title}</p><dl><div><dt>{fullReport ? "Кандидатов" : "Подготовлено"}</dt><dd>{fullReport && full ? full.summary.detectedExercises : batch.summary.processed}</dd></div><div><dt>Сверено со сканом</dt><dd>{fullReport && full ? full.summary.sourceChecked : batch.questions.length}</dd></div><div><dt>Дубликатов ID</dt><dd>{fullReport && full ? full.summary.duplicateCount : batch.summary.duplicateCount}</dd></div><div><dt>Опубликовано</dt><dd>0</dd></div></dl><ul>{(fullReport && full ? full.summary.warnings : batch.summary.warnings).map(warning => <li key={warning}>{warning}</li>)}</ul><button type="button" disabled>Публикация ожидает подтверждения прав и проверки</button></section>
  </>;
}
