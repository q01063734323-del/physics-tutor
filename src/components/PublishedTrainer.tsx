"use client";

import { recordStudioActivity } from "@/lib/studio-progress";
import Link from "next/link";
import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
import type { TrainerAttempt } from "@/lib/trainer-bank";
import { queuePreparationAttempt, flushPreparationAttempts } from "@/lib/command-center/outbox";
import type { TrainerQuestion } from "@/lib/trainer-bank";
import type { TrainerCheckResult } from "@/lib/trainer-public";
import QuestionTrainer from "./QuestionTrainer";
import styles from "./QuestionTrainer.module.css";

async function checkAnswer(question: TrainerQuestion, input: string): Promise<TrainerCheckResult> {
  const response = await fetch("/api/trainer", { method: "POST", cache: "no-store", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: question.id, version: question.version, input }) });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "Не удалось проверить ответ. Попробуй ещё раз.");
  return result;
}

export default function PublishedTrainer() {
  const [questions, setQuestions] = useState<TrainerQuestion[] | null>(null);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);
  const [syncNotice, setSyncNotice] = useState("");
  const [account, setAccount] = useState("guest");
  useEffect(() => onAuthStateChanged(auth, user => {
    const requestedDemo = new URLSearchParams(window.location.search).get("demo");
    const demo = requestedDemo === "student" || requestedDemo === "teacher" ? requestedDemo : localStorage.getItem("physics-tutor-demo");
    setAccount((requestedDemo === "student" || requestedDemo === "teacher" || process.env.NEXT_PUBLIC_ENABLE_DEMO === "true") && (demo === "teacher" || demo === "student") ? `demo-${demo}` : user?.uid || "guest");
  }), []);
  useEffect(() => {
    const retry = () => {
      void flushPreparationAttempts(account, auth.currentUser, (account === "guest" || account.startsWith("demo-"))).then(result => {
        if (!result.localOnly) setSyncNotice(result.pending ? "Часть результатов ожидает синхронизации." : "Результаты синхронизированы с центром подготовки.");
      }).catch(() => setSyncNotice("Облако временно недоступно. Локальные результаты сохранены."));
    };
    retry(); window.addEventListener("online", retry);
    return () => window.removeEventListener("online", retry);
  }, [account]);
  async function saveAttempt(attempt: TrainerAttempt) {
    await queuePreparationAttempt(account, attempt);
    if(attempt.correct) recordStudioActivity(account,"task",attempt.questionId);
    if ((account === "guest" || account.startsWith("demo-"))) { setSyncNotice("Гостевой прогресс хранится только на устройстве."); return; }
    try {
      const result = await flushPreparationAttempts(account, auth.currentUser, false);
      setSyncNotice(result.pending || result.localOnly ? "Результат сохранён на устройстве и ожидает синхронизации." : "Результат сохранён в центре подготовки.");
    } catch { setSyncNotice("Результат сохранён на устройстве. Отправка повторится при восстановлении соединения."); }
  }
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/trainer", { cache: "no-store", signal: controller.signal }).then(async response => {
      if (!response.ok) throw new Error("Банк задач временно недоступен.");
      const result = await response.json();
      if (!Array.isArray(result.questions) || !result.questions.length) throw new Error("Банк задач пока пуст.");
      setQuestions(result.questions); setError("");
    }).catch(cause => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Не удалось загрузить задачи."); });
    return () => controller.abort();
  }, [reload]);
  return <main>
    <nav className={styles.previewNav} aria-label="Навигация тренажёра"><Link href="/">← Физика с Егором</Link><Link href={account.startsWith("demo-")?`/preparation?demo=${account.slice(5)}`:"/preparation"}>Моя подготовка ↗</Link><span>Сборник 2026 · Прогресс на устройстве</span></nav>
    {syncNotice && <p role="status">{syncNotice}</p>}
    {error ? <section className={styles.trainer}><div className={styles.empty} role="alert"><h1>Не удалось открыть задачи</h1><p>{error}</p><button type="button" onClick={() => { setError(""); setReload(value => value + 1); }}>Попробовать ещё раз</button></div></section>
      : questions && account ? <QuestionTrainer key={account} questions={questions} namespace={`published-ege-2026:${account}`} checkAnswer={checkAnswer} onAttempt={saveAttempt} />
      : <section className={styles.trainer} aria-busy="true"><p role="status">Готовим задачи, рисунки и темы…</p></section>}
  </main>;
}
