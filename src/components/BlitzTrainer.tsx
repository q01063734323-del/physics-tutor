"use client";

import { recordStudioActivity } from "@/lib/studio-progress";
import { useCallback, useEffect, useMemo, useState } from "react";
import { MathText } from "./QuestionTrainer";
import { baseLatex, catalogVersion, codifier, dimensionLatex, examConstants, formulaById, formulas, groups, quantities, quantityById, sections } from "@/lib/blitz/catalog";
import { defaultSettings, examPrefixes, filterQuestions, questionById, shuffle, type Mode, type Settings } from "@/lib/blitz/questions";
import { answerSession, createSession, dayStreak, finishSession, masteryFor, mistakeIds, nextQuestion, weakFormulas, type StudyState } from "@/lib/blitz/engine";
import { useStudy } from "@/lib/blitz/use-study";
import s from "./BlitzTrainer.module.css";

const modes: { id: Mode; mark: string; title: string; description: string }[] = [
  { id: "classic", mark: "01", title: "Классический блиц", description: "Формулы, величины и СИ. Свой темп, понятный разбор." },
  { id: "guess", mark: "ƒ", title: "Угадай формулу", description: "Один закон — четыре записи. Найди нужную." },
  { id: "assemble", mark: "=", title: "Собери формулу", description: "Восстанови выражение из предложенных частей." },
  { id: "unknown", mark: "x", title: "Найди неизвестную", description: "Преобразуй закон и вырази нужную величину." },
  { id: "units", mark: "SI", title: "Единицы измерения", description: "Размерности, приставки, площади и переводы." },
  { id: "traps", mark: "!", title: "Ловушки ЕГЭ", description: "Знаки, степени, условия и привычные ошибки." },
  { id: "flash", mark: "↔", title: "Флеш-карточки", description: "Вспомни сам. Переверни. Оцени уверенность." },
  { id: "mistakes", mark: "↻", title: "Работа над ошибками", description: "Только вопросы, которые пока не получились." },
  { id: "exam", mark: "Σ", title: "Экзамен по формулам", description: "Разные разделы. Без подсказок до результата." },
  { id: "timed", mark: "90", title: "Формулы на время", description: "90 секунд, точность и твой личный рекорд." },
];

function Toggle({ active, children, onClick }: { active: boolean; children: React.ReactNode; onClick: () => void }) {
  return <button type="button" className={active ? s.selected : ""} aria-pressed={active} onClick={onClick}>{children}</button>;
}

export default function BlitzTrainer({ account = "guest", demo = false }: { account?: string; demo?: boolean }) {
  const { state, error, saving, syncing, syncMessage, update, synchronize, retry, cloudAvailable } = useStudy(account, demo);
  const [view, setView] = useState<"setup" | "study" | "result" | "statistics" | "registry">("setup");
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [flipped, setFlipped] = useState(false);
  const [resultId, setResultId] = useState("");
  const [clock, setClock] = useState(() => Date.now());
  const [search, setSearch] = useState("");
  const [registryLimit, setRegistryLimit] = useState(30);
  const [historyLimit, setHistoryLimit] = useState(10);
  const mastery = useMemo(() => masteryFor(state?.events || []), [state?.events]);
  const mistakes = useMemo(() => mistakeIds(state?.events || []), [state?.events]);
  const pool = useMemo(() => filterQuestions(settings, mistakes), [settings, mistakes]);
  const active = state?.active;
  const question = active ? questionById.get(active.questionIds[active.index]) : undefined;
  const review = active?.reviews.find(item => item.questionId === question?.id);
  const choiceOrder = useMemo(() => question && active ? shuffle(question.choices, active.seed + active.index * 101) : [], [question, active]);
  const chosenMode = modes.find(mode => mode.id === settings.mode)!;
  const formula = question?.formulaId ? formulaById.get(question.formulaId) : undefined;
  const quantity = question?.quantityId ? quantityById.get(question.quantityId) : undefined;
  const result = state?.history.find(item => item.id === resultId) || state?.history[0];
  const mastered = formulas.filter(item => mastery[`formula:${item.id}`]?.level >= 3 && mastery[`formula:${item.id}`]?.percent >= 80).length;
  const studied = formulas.filter(item => mastery[`formula:${item.id}`]).length;
  const due = formulas.filter(item => mastery[`formula:${item.id}`] && Date.parse(mastery[`formula:${item.id}`].nextDue) <= clock).length;
  const correctCount = state?.events.filter(event => event.correct).length || 0;
  const accuracy = state?.events.length ? Math.round(100 * correctCount / state.events.length) : 0;
  const weak = useMemo(() => weakFormulas(state?.events || [], clock), [state?.events, clock]);
  const weakTopics = useMemo(() => groups.map(group => {
    const attempts = (state?.events || []).filter(event => questionById.get(event.questionId)?.topics.includes(group.topic));
    const correct = attempts.filter(event => event.correct).length;
    return { topic: group.topic, attempts: attempts.length, accuracy: attempts.length ? Math.round(100 * correct / attempts.length) : 100 };
  }).filter(item => item.attempts > 0).sort((a, b) => a.accuracy - b.accuracy || b.attempts - a.attempts).slice(0, 5), [state?.events]);
  const answerStreak = active?.reviews.reduce((streak, item) => item.correct ? streak + 1 : 0, 0) || 0;
  const timeLeft = active?.deadlineAt ? Math.max(0, Math.ceil((active.deadlineAt - clock) / 1000)) : null;

  const finish = useCallback(async () => {
    let id = "", answered = 0;
    try {
      await update(previous => { id = previous.active?.id || ""; answered = previous.active?.reviews.length || 0; return finishSession(previous, Date.now()); });
      if(id && answered) recordStudioActivity(account,"blitz",id);
      setResultId(id); setView("result"); setClock(Date.now()); void synchronize();
    } catch { /* The storage message remains visible and the attempt stays resumable. */ }
  }, [update, synchronize, account]);

  const deadline = active?.deadlineAt;
  useEffect(() => {
    if (!deadline) return;
    const interval = window.setInterval(() => setClock(Date.now()), 1000);
    const timeout = window.setTimeout(() => void finish(), Math.max(0, deadline - Date.now()));
    return () => { clearInterval(interval); clearTimeout(timeout); };
  }, [deadline, finish]);

  const mutate = useCallback(async (change: (previous: StudyState) => StudyState) => {
    try { await update(change); setClock(Date.now()); return true; } catch { return false; }
  }, [update]);
  const start = useCallback(async (custom: Settings) => {
    const now = Date.now();
    const seed = crypto.getRandomValues(new Uint32Array(1))[0];
    const id = crypto.randomUUID();
    if (await mutate(previous => {
      const saved = previous.active ? finishSession(previous, now) : previous;
      return { ...saved, active: createSession(saved, custom, now, seed, id) };
    })) { setView("study"); setFlipped(false); void synchronize(); }
  }, [mutate, synchronize]);
  async function answer(value: string, selfRated?: boolean) {
    await mutate(previous => answerSession(previous, value, Date.now(), selfRated));
  }
  async function advance() {
    if (active && active.index >= active.questionIds.length - 1) { await finish(); return; }
    if (await mutate(previous => nextQuestion(previous, Date.now()))) setFlipped(false);
  }
  function toggleSection(section: string) {
    setSettings(previous => ({ ...previous, topics: [], sections: previous.sections.includes(section) ? previous.sections.filter(item => item !== section) : [...previous.sections, section] }));
  }
  function chooseMode(mode: Mode) { setSettings(previous => ({ ...previous, mode })); }
  const availableCount = settings.count === "all" ? pool.length : Math.min(pool.length, settings.count);
  const currentFormulaCount = state?.events.length || 0;
  const best = Math.max(0, ...(state?.history.filter(item => item.mode === "timed").map(item => item.correct) || []));
  const visibleRegistry = formulas.filter(item => !search.trim() || [item.title, item.latex, item.topic, item.code, item.conditions].join(" ").toLocaleLowerCase("ru").includes(search.toLocaleLowerCase("ru")));

  if (!state) return <section className={s.blitz}><div className={s.loading} aria-busy={!error}><span>ФИЗИКА С ЕГОРОМ / БЛИЦ</span><h2>{error ? "Откроем сохранения ещё раз" : "Готовим твою тренировку"}</h2><p role={error ? "alert" : "status"}>{error || "Формулы, единицы и твой прогресс."}</p>{error && <button type="button" onClick={retry}>Повторить</button>}</div></section>;

  return <section className={s.blitz} aria-label="Блиц-тренажёр формул ЕГЭ">
    <div className={s.topline}><span>ФИЗИКА С ЕГОРОМ <i/> ПРАКТИКА ПАМЯТИ</span><span className={s.year}>ЕГЭ · 2027</span></div>
    <nav className={s.nav} aria-label="Разделы блиц-тренажёра">{[["setup", "Тренировки"], ["statistics", "Мой прогресс"], ["registry", "Все формулы"]].map(([id, label]) => <button type="button" key={id} className={view === id ? s.navActive : ""} onClick={() => setView(id as typeof view)}>{label}</button>)}</nav>
    <div className={s.syncBar} role="status"><span className={s.dot}/><span>{saving ? "Сохраняем на устройстве…" : syncing ? "Синхронизируем…" : syncMessage || (cloudAvailable ? "Прогресс на устройстве · синхронизация с аккаунтом" : `${demo ? "Демо-режим" : "Гостевой режим"} · прогресс сохранён на этом устройстве, без синхронизации`)}</span>{cloudAvailable && <button type="button" disabled={syncing} onClick={() => void synchronize()}>Повторить синхронизацию</button>}</div>
    {error && <div className={s.error} role="alert">{error}</div>}

    {view === "setup" && <>
      <header className={s.hero}><div><p className={s.eyebrow}>ЗНАНИЕ, КОТОРОЕ ОСТАЁТСЯ</p><h1>Не просто узнать.<br/><em>Вспомнить самому.</em></h1><p className={s.lead}>Формулы становятся понятнее с каждой попыткой.<br/>Выбери свой способ практики — от первого закона до уверенного решения.</p><div className={s.heroMeta}><span>{formulas.length} формул и преобразований</span><span>{quantities.length} величин СИ</span><span>{codifier.elements.length} пунктов ФИПИ</span></div></div><aside className={s.orbit}><span>ТВОЯ ФОРМУЛА ПРОГРЕССА</span><div className={s.ring} style={{ "--progress": `${Math.round(100 * mastered / formulas.length)}%` } as React.CSSProperties}><strong>{mastered}<small>освоено из {formulas.length}</small></strong></div><p>Не выучить всё за раз.<br/>А возвращаться вовремя.</p></aside></header>
      {active && <div className={s.resume}><div><b>Твоя тренировка сохранена</b><span>{modes.find(item => item.id === active.settings.mode)?.title} · {active.reviews.length} из {active.questionIds.length} ответов</span></div>{active.catalogVersion === catalogVersion ? <button type="button" onClick={() => setView("study")}>Продолжить →</button> : <button type="button" onClick={() => void finish()}>Каталог обновился · сохранить итог</button>}</div>}
      <div className={s.sectionHeading}><div><p className={s.eyebrow}>ДЕСЯТЬ СПОСОБОВ ПОНЯТЬ</p><h2>Как потренируемся?</h2></div><span>Выбери режим, затем темы</span></div>
      <div className={s.modeGrid}>{modes.map((mode, index) => <button type="button" key={mode.id} aria-pressed={settings.mode === mode.id} className={`${s.mode} ${settings.mode === mode.id ? s.modeActive : ""}`} onClick={() => chooseMode(mode.id)}><div><span className={s.modeMark}>{mode.mark}</span><small>{String(index + 1).padStart(2, "0")}</small></div><h3>{mode.title}</h3><p>{mode.description}</p><span className={s.modeArrow}>↗</span></button>)}</div>
      <section className={s.configure} aria-label="Настройки тренировки"><div className={s.configureTitle}><span className={s.eyebrow}>ТВОЙ МАРШРУТ</span><h2>{chosenMode.title}</h2><p>{chosenMode.description}</p></div><div className={s.controls}>
        <fieldset><legend>Разделы физики</legend><div className={s.chips}><Toggle active={!settings.sections.length} onClick={() => setSettings(previous => ({ ...previous, sections: [], topics: [] }))}>Все разделы</Toggle>{sections.map(section => <Toggle key={section} active={settings.sections.includes(section)} onClick={() => toggleSection(section)}>{section}</Toggle>)}</div></fieldset>
        <details className={s.topicDetails}><summary>Конкретные темы · {settings.topics.length ? `выбрано ${settings.topics.length}` : "все темы"}</summary><div className={s.topicGrid}>{groups.filter(group => !settings.sections.length || settings.sections.includes(group.section)).map(group => <label key={group.code}><input type="checkbox" checked={settings.topics.includes(group.topic)} onChange={() => setSettings(previous => ({ ...previous, topics: previous.topics.includes(group.topic) ? previous.topics.filter(item => item !== group.topic) : [...previous.topics, group.topic] }))}/>{group.topic}</label>)}</div><button type="button" onClick={() => setSettings(previous => ({ ...previous, topics: [] }))}>Все темы</button></details>
        <div className={s.selectGrid}><label>Содержание<select value={settings.content} onChange={event => setSettings(previous => ({ ...previous, content: event.target.value as Settings["content"] }))}><option value="mixed">Формулы и СИ</option><option value="formulas">Только формулы</option><option value="units">Только единицы СИ</option></select></label><label>Сложность<select value={settings.difficulty} onChange={event => setSettings(previous => ({ ...previous, difficulty: Number(event.target.value) }))}><option value="0">Все уровни</option><option value="1">Лёгкий · узнавание</option><option value="2">Средний · преобразования</option><option value="3">Сложный · связи и ловушки</option></select></label><label>Вопросов<select value={settings.count} onChange={event => setSettings(previous => ({ ...previous, count: event.target.value === "all" ? "all" : Number(event.target.value) }))}>{[10, 20, 30, 50, 100].map(count => <option key={count} value={count}>{count}</option>)}<option value="all">Все доступные</option></select></label></div>
        <div className={s.startRow}><div><b>{availableCount} вопросов в тренировке</b><p>{!pool.length ? settings.mode === "mistakes" ? "Ошибок по этим фильтрам нет. Выбери другой режим или сбрось фильтры." : "По этим фильтрам вопросов нет. Измени содержание, тему или сложность." : settings.count !== "all" && pool.length < settings.count ? `Доступно ${pool.length} вместо ${settings.count}. Повторять одинаковые вопросы не будем.` : `${pool.length} доступно по выбранным фильтрам · без повторов`}</p></div><button type="button" className={s.primary} disabled={!pool.length || saving} onClick={() => void start(settings)}>Начать тренировку <span>→</span></button></div>
      </div></section>
      <details className={s.reference}><summary>Что даётся на ЕГЭ, а что нужно помнить?</summary><p>В просмотренной демоверсии нет общего листа основных законов. Выдаются константы, приставки и отдельные соотношения. «Вывести» у формулы означает применимую форму, полученную из законов кодификатора.</p><div className={s.referenceGrid}>{examConstants.map(([name, latex]) => <article key={name}><span>{name}</span><MathText text={`$${latex}$`}/></article>)}</div><div className={s.prefixes}>{examPrefixes.map(([name, symbol, exponent]) => <span key={name}>{name} ({symbol}) <MathText text={`$10^{${exponent}}$`}/></span>)}</div><a href={codifier.archiveUrl} target="_blank" rel="noreferrer">Официальные материалы ФИПИ-2027 ↗</a></details>
    </>}

    {view === "study" && active && question && <section className={s.study}>
      <div className={s.studyHeading}><button type="button" onClick={() => setView("setup")}>← Пауза и выбор режима</button><span>{modes.find(mode => mode.id === active.settings.mode)?.title}</span>{timeLeft !== null && <strong className={timeLeft <= 15 ? s.timerWarning : s.timer} aria-label="Осталось секунд">{timeLeft}<small>сек</small></strong>}</div>
      <div className={s.questionProgress}>{active.settings.mode === "timed" && <b>Серия: {answerStreak} верных подряд</b>}<span>Вопрос {active.index + 1} из {active.questionIds.length}</span><span>{active.settings.mode === "exam" ? "Разбор после завершения" : `${active.reviews.filter(item => item.correct).length} верно`}</span><progress value={active.reviews.length} max={active.questionIds.length}/></div>
      {active.settings.mode === "flash" ? <>
        <button type="button" className={`${s.flash} ${flipped || review ? s.flashRevealed : ""}`} aria-expanded={flipped || Boolean(review)} aria-label={flipped || review ? "Формула и объяснение карточки" : "Перевернуть карточку"} onClick={() => setFlipped(previous => !previous)}><span className={s.eyebrow}>{question.topics[0]}</span>{!flipped && !review ? <><h2>{formula?.title || quantity?.name}</h2><p>Сначала вспомни сам</p><span className={s.flipLabel}>Показать ответ ↔</span></> : <><h2>{formula?.title || quantity?.name}</h2><div className={s.bigFormula}><MathText text={formula ? `$${formula.latex}$` : quantity?.unit || question.correct}/></div><p>{formula?.conditions || quantity?.mistake}</p>{formula && <div className={s.variableGrid}>{formula.variables.map(variable => <span key={variable.symbol}><MathText text={`$${variable.symbol}$`}/> — {variable.name}, {variable.unit}</span>)}</div>}{quantity && <p><MathText text={`$${baseLatex(quantity.baseSI)}$ · $${dimensionLatex(quantity.dimension)}$`}/></p>}<small>{question.source}</small></>}</button>
        {(flipped || review) && !review && <div className={s.flashActions}><button type="button" disabled={saving} onClick={() => void answer("Нужно повторить", false)}>Нужно повторить</button><button type="button" className={s.primary} disabled={saving} onClick={() => void answer("Вспомнил уверенно", true)}>Вспомнил уверенно</button></div>}
        <p className={s.selfRating}>Самооценка карточки влияет на повторение. Это не проверка экзаменационного ответа.</p>
      </> : <article className={s.question} key={question.id}><div className={s.questionMeta}><span>{question.topics[0]}</span><span>{["", "Узнавание", "Преобразование", "Применение"][question.difficulty]}</span></div><h2><MathText text={question.prompt}/></h2><p className={s.context}><MathText text={question.context}/></p><div className={`${s.choices} ${question.kind === "assemble" ? s.assembly : ""}`}>{choiceOrder.map((choice, index) => <button type="button" key={choice} disabled={Boolean(review) || saving || timeLeft === 0} className={`${review?.selected === choice ? s.choiceSelected : ""} ${review && active.settings.mode !== "exam" ? choice === question.correct ? s.choiceCorrect : review.selected === choice ? s.choiceWrong : "" : ""}`} onClick={() => void answer(choice)}><span>{String.fromCharCode(65 + index)}</span><div><MathText text={choice}/></div></button>)}</div>
        {review && <div role="status" className={`${s.feedback} ${active.settings.mode === "exam" ? "" : review.correct ? s.feedbackCorrect : s.feedbackWrong}`}><b>{active.settings.mode === "exam" ? "Ответ записан. Разбор — после завершения." : review.correct ? "Верно. Продолжаем." : "Пока не получилось. Разберёмся."}</b>{active.settings.mode !== "exam" && <p><MathText text={question.explanation}/></p>}</div>}
        {review && active.settings.mode !== "exam" && formula && <details className={s.explanation}><summary>Обозначения, единицы и условия</summary><div className={s.variableGrid}>{formula.variables.map(variable => <span key={variable.symbol}><MathText text={`$${variable.symbol}$`}/> — {variable.name}, {variable.unit}</span>)}</div><p>{formula.conditions}</p><small>{formula.provided ? "Есть в справочных данных" : formula.kind === "derive" ? "Вывод / применение закона" : "Соотношение кодификатора"} · {question.source}</small></details>}
      </article>}
      <div className={s.studyActions}><button type="button" disabled={saving} onClick={() => void finish()}>Завершить сейчас</button>{review && <button type="button" className={s.primary} disabled={saving} onClick={() => void advance()}>{active.index === active.questionIds.length - 1 ? "Посмотреть результат" : "Следующий вопрос →"}</button>}{timeLeft === 0 && <button type="button" className={s.primary} disabled={saving} onClick={() => void finish()}>Сохранить итог</button>}</div>
    </section>}

    {view === "result" && <section className={s.result}>{result ? <><p className={s.eyebrow}>ЕЩЁ ОДИН ШАГ ВПЕРЁД</p><h1>{result.mode === "flash" ? "Карточки повторены." : "Тренировка завершена."}</h1><div className={s.score}><strong>{result.correct}<small> / {result.total}</small></strong><div><b>{result.mode === "flash" ? "уверенных самооценок" : "правильных ответов"}</b><span>{result.reviews.length} ответов · {result.duration} сек · {Math.max(0, result.total - result.reviews.length)} без ответа</span></div></div><p>Результат сохранён на устройстве.{cloudAvailable ? " Синхронизация с аккаунтом выполняется отдельно." : " В гостевом и демо-режиме он не отправляется в Firebase."}</p><div className={s.resultActions}><button type="button" className={s.primary} onClick={() => setView("setup")}>Новая тренировка →</button><button type="button" onClick={() => setView("statistics")}>Мой прогресс</button>{mistakes.length > 0 && <button type="button" onClick={() => void start({ ...defaultSettings, mode: "mistakes", count: "all" })}>Разобрать ошибки · {mistakes.length}</button>}</div><h2>Разбор твоих ответов</h2><div className={s.reviewList}>{result.reviews.map(item => { const q = questionById.get(item.questionId); return q ? <details key={item.id}><summary><span className={item.correct ? s.good : s.bad}>{item.correct ? "✓" : "×"}</span><MathText text={q.prompt}/></summary><p>Твой ответ: <MathText text={item.selected}/></p><p>Правильный ответ: <MathText text={q.correct}/></p><p><MathText text={q.explanation}/></p><small>{q.source}</small></details> : null; })}</div></> : <><h2>Начни с первой тренировки</h2><button type="button" onClick={() => setView("setup")}>Выбрать режим</button></>}</section>}

    {view === "statistics" && <section className={s.statistics}><p className={s.eyebrow}>МАЛЕНЬКИЕ ПОВТОРЕНИЯ. БОЛЬШОЙ РЕЗУЛЬТАТ.</p><h1>Твоя траектория.</h1><div className={s.metrics}>{[[studied, "формул изучено"], [mastered, "освоено"], [due, "пора повторить"], [`${accuracy}%`, "успех в тренировках"], [dayStreak(state.events, clock), "дней подряд"], [best, "рекорд за 90 секунд"]].map(([value, label]) => <article key={label}><strong>{value}</strong><span>{label}</span></article>)}</div><p className={s.note}>Освоение: не менее трёх успешных повторений подряд и не менее 80% правильных ответов. Самооценки карточек также учитываются.</p><div className={s.statsColumns}><section className={s.panel}><h2>По разделам</h2>{sections.map(section => { const list = formulas.filter(formula => formula.section === section); const known = list.filter(formula => mastery[`formula:${formula.id}`]?.level >= 3 && mastery[`formula:${formula.id}`]?.percent >= 80).length; return <div className={s.sectionProgress} key={section}><span>{section}</span><b>{known} / {list.length}</b><progress value={known} max={list.length}/></div>; })}</section><section className={s.panel}><h2>Слабые формулы</h2>{weak.length ? weak.slice(0, 8).map(item => <article className={s.weak} key={item.formula!.id}><div><b>{item.formula!.title}</b><span>{item.mastery.errors} ошибок · {item.mastery.percent}% верно</span></div><MathText text={`$${item.formula!.latex}$`}/></article>) : <p className={s.note}>Здесь появятся формулы, которым нужно больше внимания. Начни тренировку.</p>}</section></div><section className={s.panel}><h2>Темы, которым нужно внимание</h2>{weakTopics.length ? weakTopics.map(item => <div className={s.historyRow} key={item.topic}><div><b>{item.topic}</b><span>{item.attempts} ответов</span></div><strong>{item.accuracy}%</strong></div>) : <p className={s.note}>После первых ответов здесь появится точность по темам.</p>}</section><section className={s.panel}><h2>История тренировок</h2><span className={s.note}>{currentFormulaCount} ответов сохранено · {state.history.length} тренировок · {state.pending.length} ожидают синхронизации</span>{state.history.slice(0, historyLimit).map(item => <div className={s.historyRow} key={item.id}><div><b>{modes.find(mode => mode.id === item.mode)?.title}</b><span>{new Date(item.finishedAt).toLocaleString("ru-RU")} · {item.duration} сек</span></div><strong>{item.correct} / {item.total}</strong><span>{state.syncedIds.includes(item.id) ? "В аккаунте" : "На устройстве"}</span></div>)}{!state.history.length && <p className={s.note}>Первая завершённая тренировка появится здесь.</p>}{state.history.length > historyLimit && <button type="button" onClick={() => setHistoryLimit(value => value + 10)}>Показать ещё</button>}</section></section>}

    {view === "registry" && <section className={s.registry}><p className={s.eyebrow}>ОДИН ПРОВЕРЯЕМЫЙ РЕЕСТР</p><h1>Формулы. Со смыслом.</h1><p className={s.lead}>Законы, преобразования, величины и условия применимости. Никаких формул без контекста.</p><label className={s.search}>Найти формулу, тему или код ФИПИ<input type="search" value={search} placeholder="Например: конденсатор или 3.1.9" onChange={event => { setSearch(event.target.value); setRegistryLimit(30); }}/></label><p className={s.note}>{visibleRegistry.length} из {formulas.length} формул и преобразований · {codifier.elements.length} пунктов кодификатора учтено</p><div className={s.registryList}>{visibleRegistry.slice(0, registryLimit).map(formula => <details key={formula.id}><summary><span>{formula.topic}</span><h3>{formula.title}</h3><div className={s.registryMath}><MathText text={`$${formula.latex}$`}/></div><small>{formula.provided ? "Справочные данные" : formula.kind === "derive" ? "Вывести / применить" : "Знать"} · {formula.code}</small></summary><p>{formula.conditions}</p><div className={s.variableGrid}>{formula.variables.map(variable => <span key={variable.symbol}><MathText text={`$${variable.symbol}$`}/> — {variable.name}, {variable.unit}</span>)}</div><small>Источник: ФИПИ-2027, {formula.source.document === "demo-reference" ? "демоверсия, справочные данные" : "кодификатор"}, печатная страница {formula.source.printedPage}.</small><p className={s.note}>Обрати внимание: {formula.mistake}</p></details>)}</div>{!visibleRegistry.length && <p>Совпадений нет. Попробуй другое название или код.</p>}{visibleRegistry.length > registryLimit && <button type="button" className={s.primary} onClick={() => setRegistryLimit(value => value + 30)}>Ещё 30 формул</button>}<a className={s.sourceLink} href={codifier.archiveUrl} target="_blank" rel="noreferrer">Официальные документы ФИПИ ↗</a></section>}
    <footer className={s.footer}><span>Физика с Егором</span><span>Вспоминать. Проверять. Возвращаться.</span></footer>
  </section>;
}
