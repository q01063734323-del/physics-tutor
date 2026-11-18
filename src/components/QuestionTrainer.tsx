/* eslint-disable @next/next/no-img-element -- Private source crops must bypass image optimization and retain scan proportions. */
"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import katex from "katex";
import "katex/dist/katex.min.css";
import { displayTrainerAnswer, filterTrainerQuestions, gradeTrainerAnswer, initialTrainerFilters, latestAttempt, physicsSections, trainerProgress, type TrainerAttempt, type TrainerFilters, type TrainerQuestion } from "@/lib/trainer-bank";
import styles from "./QuestionTrainer.module.css";
import SourceScan from "./SourceScan";
import type { TrainerCheckResult } from "@/lib/trainer-public";

function subscribeProgress(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener("physics-trainer-progress", callback);
  return () => { window.removeEventListener("storage", callback); window.removeEventListener("physics-trainer-progress", callback); };
}

function readProgress(key: string) {
  try { return window.localStorage.getItem(key) || "[]"; } catch { return "[]"; }
}

export function MathText({ text }: { text: string }) {
  const chunks = text.split(/(\$\$[\s\S]*?\$\$|\$[^$\n]+\$)/g);
  return <>{chunks.map((chunk, index) => {
    if (!chunk.startsWith("$") || !chunk.endsWith("$")) return <span key={index}>{chunk}</span>;
    const display = chunk.startsWith("$$");
    const latex = chunk.slice(display ? 2 : 1, display ? -2 : -1);
    try {
      const html = katex.renderToString(latex, { displayMode: display, throwOnError: true, trust: false, strict: "error", maxExpand: 200, maxSize: 12, output: "htmlAndMathml" });
      return <span key={index} className={display ? styles.displayMath : styles.math} dangerouslySetInnerHTML={{ __html: html }} />;
    } catch {
      return <span key={index} className={styles.mathError} title="Формула требует проверки">{chunk}</span>;
    }
  })}</>;
}

type Props = { questions: TrainerQuestion[]; namespace: string; preview?: boolean; onAttempt?: (attempt: TrainerAttempt) => Promise<void>; checkAnswer?: (question: TrainerQuestion, input: string) => Promise<TrainerCheckResult> };

export default function QuestionTrainer({ questions, namespace, preview = false, onAttempt, checkAnswer }: Props) {
  const [filters, setFilters] = useState<TrainerFilters>(initialTrainerFilters);
  const [view, setView] = useState<"catalog" | "practice">("catalog");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [queueIds, setQueueIds] = useState<string[]>([]);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [completed, setCompleted] = useState<Record<string, TrainerAttempt>>({});
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [revealed, setRevealed] = useState<Record<string, TrainerCheckResult>>({});
  const [catalogPage, setCatalogPage] = useState(0);
  const pageSize = 30;
  const storageKey = `physics-trainer-v1:${namespace}`;
  const saved = useSyncExternalStore(subscribeProgress, () => readProgress(storageKey), () => "[]");
  const attempts = useMemo<TrainerAttempt[]>(() => {
    try {
      const value = JSON.parse(saved);
      return Array.isArray(value) ? value.filter(attempt => attempt && typeof attempt.id === "string" && typeof attempt.questionId === "string" && typeof attempt.version === "string" && typeof attempt.input === "string" && [true, false, null].includes(attempt.correct)).slice(-10000) : [];
    } catch { return []; }
  }, [saved]);
  const visible = useMemo(() => filterTrainerQuestions(questions, filters, attempts), [questions, filters, attempts]);
  const activeQuestions = view === "practice" ? queueIds.flatMap(id => questions.find(question => question.id === id) || []) : visible;
  const current = activeQuestions.find(question => question.id === selectedId) || activeQuestions[0];
  const currentIndex = current ? activeQuestions.findIndex(question => question.id === current.id) : -1;
  const totals = trainerProgress(questions, attempts);
  const topics = [...new Set(questions.filter(question => filters.section === "all" || question.section === filters.section).flatMap(question => question.topics))];
  const activeAttempt = current ? completed[`${current.id}:${current.version}`] : undefined;
  const reveal = current ? revealed[`${current.id}:${current.version}`] : undefined;
  const solutionAssets = (reveal?.assets || current?.assets || []).filter(asset => asset.role === "solution");
  const solution = reveal?.solution ?? current?.solution;
  const pages = Math.max(1, Math.ceil(visible.length / pageSize));
  const page = Math.min(catalogPage, pages - 1);

  function changeFilter(patch: Partial<TrainerFilters>) {
    setFilters(previous => ({ ...previous, ...patch }));
    setSelectedId(null);
    setView("catalog");
    setMessage("");
    setCatalogPage(0);
  }

  function start(question?: TrainerQuestion) {
    setQueueIds(visible.map(item => item.id));
    setSelectedId(question?.id || visible[0]?.id || null);
    setView("practice");
    setMessage("");
  }

  async function submit() {
    if (!current || saving || activeAttempt) return;
    const input = (answers[current.id] || "").trim();
    if (!input) { setMessage("Сначала введи свой ответ."); return; }
    let result: ReturnType<typeof gradeTrainerAnswer>;
    if (checkAnswer) {
      setSaving(true);
      try {
        const checked = await checkAnswer(current, input);
        setRevealed(previous => ({ ...previous, [`${current.id}:${current.version}`]: checked }));
        result = checked;
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Не удалось проверить ответ. Попробуй ещё раз.");
        return;
      } finally { setSaving(false); }
    } else result = gradeTrainerAnswer(current, input);
    const attempt: TrainerAttempt = { id: crypto.randomUUID(), questionId: current.id, version: current.version, input, correct: result.correct, createdAt: new Date().toISOString() };
    setCompleted(previous => ({ ...previous, [`${current.id}:${current.version}`]: attempt }));
    let note = result.feedback;
    try {
      window.localStorage.setItem(storageKey, JSON.stringify([...attempts, attempt].slice(-10000)));
      window.dispatchEvent(new Event("physics-trainer-progress"));
    } catch { note += " Прогресс не удалось сохранить в этом браузере."; }
    if (onAttempt) {
      setSaving(true);
      try { await onAttempt(attempt); }
      catch { note += " Синхронизация не удалась; результат остался на этом устройстве."; }
      finally { setSaving(false); }
    }
    setMessage(note);
  }

  return <section className={styles.trainer} aria-label="Банк задач ЕГЭ по физике">
    <header className={styles.header}>
      <div><span className={styles.eyebrow}>PHYSICS TUTOR / ПРАКТИКА</span><h1>Разобраться.<br /><em>Решить самому.</em></h1><p>Один банк задач. Два способа найти нужное.</p></div>
      <div className={styles.progressCard} aria-label="Твой прогресс"><span>ТВОЙ ПРОГРЕСС</span><strong>{totals.solved}<small> / {totals.total}</small></strong><p>задач решено верно</p><progress value={totals.solved} max={totals.total || 1} /><div><span>Попытки: {totals.attempted}</span><span>Повторить: {totals.mistakes}</span></div></div>
    </header>
    {preview && <div className={styles.draftNotice}><span className={styles.draftDot} /><div><strong>Локальный черновик</strong><span>Задания не опубликованы. Права и проверку преподавателем нужно подтвердить отдельно.</span></div><span className={styles.draftLabel}>ПРЕДПРОСМОТР</span></div>}
    <div className={styles.modeBar}>
      <div className={styles.modeSwitch} role="group" aria-label="Способ поиска"><button type="button" aria-pressed={filters.mode === "numbers"} onClick={() => changeFilter({ mode: "numbers" })}><span>01—26</span>По номерам ЕГЭ</button><button type="button" aria-pressed={filters.mode === "topics"} onClick={() => changeFilter({ mode: "topics" })}><span>F = ma</span>По темам</button></div>
      <label className={styles.search}><span aria-hidden="true">⌕</span><input type="search" value={filters.query} onChange={event => changeFilter({ query: event.target.value })} placeholder="Найти задачу, тему или номер…" aria-label="Поиск задач" /></label>
    </div>
    <button type="button" className={styles.mobileFilters} aria-expanded={filtersOpen} aria-controls="trainer-filters" onClick={() => setFiltersOpen(value => !value)}>Фильтры <span>{filtersOpen ? "Свернуть −" : "Открыть +"}</span></button>
    <div className={styles.workspace}>
      <aside id="trainer-filters" className={`${styles.sidebar} ${filtersOpen ? styles.sidebarOpen : ""}`}>
        {filters.mode === "numbers" ? <><div className={styles.filterHeading}><span>НОМЕР ЗАДАНИЯ</span><button type="button" onClick={() => changeFilter({ number: "all" })}>Все</button></div><div className={styles.numberGrid}>{Array.from({ length: 26 }, (_, index) => index + 1).map(number => {
          const count = questions.filter(question => question.examNumber === number).length;
          return <button type="button" key={number} disabled={!count} aria-pressed={filters.number === number} aria-label={`Задание ${number}: ${count} задач`} onClick={() => changeFilter({ number })}>{number}<small>{count || "—"}</small></button>;
        })}</div><button type="button" className={styles.unmapped} aria-pressed={filters.number === "unmapped"} onClick={() => changeFilter({ number: "unmapped" })}>Без подтверждённого номера <b>{questions.filter(question => question.examNumber === null).length}</b></button><p className={styles.filterNote}>Номера присвоены только при наличии подтверждения в источнике.</p></> : <><div className={styles.filterHeading}><span>РАЗДЕЛ ФИЗИКИ</span></div><div className={styles.sectionList}><button type="button" aria-pressed={filters.section === "all"} onClick={() => changeFilter({ section: "all", topic: "all" })}>Все разделы<span>{questions.length}</span></button>{physicsSections.map(section => {
          const count = questions.filter(question => question.section === section).length;
          return count ? <button key={section} type="button" aria-pressed={filters.section === section} onClick={() => changeFilter({ section, topic: "all" })}>{section}<span>{count}</span></button> : null;
        })}</div><label className={styles.topicLabel}>КОНКРЕТНАЯ ТЕМА<select value={filters.topic} onChange={event => changeFilter({ topic: event.target.value })}><option value="all">Все темы</option>{topics.map(topic => <option key={topic}>{topic}</option>)}</select></label></>}
        <div className={styles.sidebarFoot}><span>ПРАКТИКА БЕЗ СПЕШКИ</span><p>Сначала реши задачу самостоятельно. Ответ и разбор появятся после попытки.</p></div>
      </aside>
      <div className={styles.main}>
        <div className={styles.resultsBar}><div><span>{view === "catalog" ? "БАНК ЗАДАЧ" : "ПОСЛЕДОВАТЕЛЬНАЯ ПРАКТИКА"}</span><h2>{activeQuestions.length} {activeQuestions.length === 1 ? "задача" : activeQuestions.length > 1 && activeQuestions.length < 5 ? "задачи" : "задач"}<small>в выбранном наборе</small></h2></div><label><span className={styles.srOnly}>Фильтр по прогрессу</span><select value={filters.progress} onChange={event => changeFilter({ progress: event.target.value as TrainerFilters["progress"] })}><option value="all">Все задачи</option><option value="new">Без попыток</option><option value="mistakes">На повторение</option><option value="solved">Решённые верно</option></select></label></div>
        {!activeQuestions.length ? <div className={styles.empty}><span>∅</span><h3>Здесь пока нет задач</h3><p>Попробуй другую тему или сбрось фильтры.</p><button type="button" className={styles.primary} onClick={() => { setFilters(initialTrainerFilters); setView("catalog"); }}>Сбросить фильтры</button></div> : view === "catalog" ? <>
          <div className={styles.startRow}><div><strong>От одной задачи к следующей</strong><p>Решай в удобном темпе и возвращайся к сложным местам.</p></div><button type="button" className={styles.primary} onClick={() => start()}>Начать практику <span>↗</span></button></div>
          <div className={styles.taskList}>{visible.slice(page * pageSize, (page + 1) * pageSize).map((question, index) => {
            const previous = latestAttempt(question, attempts);
            return <article key={question.id} className={styles.taskRow}><span className={styles.taskIndex}>{String(page * pageSize + index + 1).padStart(2, "0")}</span><div><div className={styles.taskMeta}><span>{question.examNumber ? `ЕГЭ · № ${question.examNumber}` : "Номер не подтверждён"}</span><span>{question.section}</span>{previous && <span className={previous.correct ? styles.solved : styles.retry}>{previous.correct === true ? "Решено" : previous.correct === false ? "Повторить" : "На разбор"}</span>}</div><h3><MathText text={question.prompt} /></h3><div className={styles.taskBottom}><span>{question.source.taskLabel}</span>{question.assets.some(asset => asset.role === "diagram") && <span>С рисунком</span>}<span>{question.source.pdfPage ? `PDF · с. ${question.source.pdfPage}` : "Существующий банк"}</span></div></div><button type="button" className={styles.solveButton} onClick={() => start(question)} aria-label={`Решать задачу ${question.source.taskLabel}`}>Решать <span>→</span></button></article>;
          })}</div>
          {pages > 1 && <nav className={styles.bookControls} aria-label="Страницы каталога"><button type="button" disabled={page === 0} onClick={() => setCatalogPage(page - 1)}>← Назад</button><span>Страница {page + 1} / {pages}</span><button type="button" disabled={page >= pages - 1} onClick={() => setCatalogPage(page + 1)}>Далее →</button></nav>}
        </> : current && <>
          <div className={styles.practiceNav}><button type="button" onClick={() => setView("catalog")}>← К списку задач</button><span>{currentIndex + 1} / {activeQuestions.length}</span></div>
          <article className={styles.problem} key={current.id}>
            <div className={styles.taskMeta}><span>{current.examNumber ? `ЕГЭ · № ${current.examNumber}` : "Номер не подтверждён"}</span><span>{current.section}</span>{preview && <span>Черновик</span>}</div>
            <h2>{current.topics[0]}</h2><div className={styles.prompt}><MathText text={current.prompt} /></div>
            {current.assets.filter(asset => asset.role === "scan").map(asset => <figure className={styles.scan} key={asset.id}><SourceScan src={asset.url} alt={asset.alt} /><figcaption>{asset.alt}</figcaption></figure>)}
            {current.assets.filter(asset => !asset.role || asset.role === "diagram").map(asset => <figure className={styles.figure} key={asset.id}>{/* Native img preserves original scan proportions and private URLs. */}
              
              <img src={asset.url} alt={asset.alt} loading="lazy" /><figcaption>{asset.alt}</figcaption></figure>)}
            <form className={styles.answerForm} onSubmit={event => { event.preventDefault(); void submit(); }}><label htmlFor={`answer-${current.id}`}>Твой ответ {current.answer?.type === "numeric" && current.answer.unit ? <small>в {current.answer.unit}</small> : null}</label><div><input id={`answer-${current.id}`} value={answers[current.id] || ""} inputMode={current.answer?.type === "numeric" ? "decimal" : "text"} autoComplete="off" spellCheck={false} placeholder={current.answer?.type === "multi_select" ? "Например, 1 3 5" : "Введи ответ"} disabled={Boolean(activeAttempt)} onChange={event => { setAnswers(previous => ({ ...previous, [current.id]: event.target.value })); setMessage(""); }} /><button type="submit" className={styles.primary} disabled={!answers[current.id]?.trim() || Boolean(activeAttempt) || saving}>{saving ? "Проверяем…" : activeAttempt ? "Попытка завершена" : "Проверить ответ"}</button></div>{current.answer?.type === "sequence" && <small>Порядок значений важен.{current.answer.compact ? " Цифры можно вводить подряд." : " Разделяй значения пробелами или точкой с запятой."}</small>}</form>
            {message && <div role="status" className={`${styles.feedback} ${activeAttempt?.correct === true ? styles.feedbackSuccess : activeAttempt?.correct === false ? styles.feedbackError : ""}`}>{message}</div>}
            {activeAttempt && <section className={styles.solution}><span>ПОСЛЕ ПОПЫТКИ</span><h3>Ответ: {displayTrainerAnswer(reveal?.answer || current.answer)}</h3>{solution ? <div><MathText text={solution} /></div> : solutionAssets.length ? null : <p>Проверенное подробное решение пока не добавлено. Разбери ход решения с преподавателем.</p>}{solutionAssets.map(asset => <figure className={styles.scan} key={asset.id}><SourceScan src={asset.url} alt={asset.alt} /><figcaption>{asset.alt}</figcaption></figure>)}<small>Источник ответа: {current.source.answerPage ? `PDF, с. ${current.source.answerPage}` : current.source.title}</small><button type="button" onClick={() => { setCompleted(previous => { const next = { ...previous }; delete next[`${current.id}:${current.version}`]; return next; }); setAnswers(previous => ({ ...previous, [current.id]: "" })); setMessage(""); }}>Решить ещё раз</button></section>}
            <footer className={styles.source}><b>{current.source.title}</b><span>{current.source.taskLabel}{current.source.pdfPage ? ` · PDF с. ${current.source.pdfPage}` : ""}{current.source.printedPage ? ` · страница книги ${current.source.printedPage}` : ""}</span></footer>
            {preview && <details className={styles.review}><summary>Сверка со сканом и статус проверки</summary><p>{current.mapping.evidence}</p><p>Проверка преподавателем: {current.review.status === "verified" ? "подтверждена" : "ожидается"}. Права: {current.rights.status === "approved" ? "подтверждены" : "не подтверждены"}.</p>{current.review.issues.map(issue => <p key={issue}>{issue}</p>)}{current.assets.filter(asset => asset.role === "condition" || (activeAttempt && asset.role === "answer")).map(asset => <figure className={styles.scan} key={asset.id}><img src={asset.url} alt={asset.alt} loading="lazy" /><figcaption>{asset.alt}</figcaption></figure>)}</details>}
          </article>
          <div className={styles.nextRow}><button type="button" disabled={currentIndex < 1} onClick={() => { setSelectedId(activeQuestions[currentIndex - 1].id); setMessage(""); }}>← Предыдущая</button><button type="button" className={styles.primary} disabled={currentIndex >= activeQuestions.length - 1} onClick={() => { setSelectedId(activeQuestions[currentIndex + 1].id); setMessage(""); }}>Следующая задача →</button></div>
        </>}
      </div>
    </div>
    <footer className={styles.trainerFoot}>Физика с Егором<span>{preview ? "Прогресс этого предпросмотра хранится только на устройстве" : "Прогресс сохраняется в этом браузере"}</span></footer>
  </section>;
}
