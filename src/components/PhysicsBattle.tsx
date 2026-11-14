"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import {
  answerIsCorrect, battleModes, battleQuestions, battleTopics, buildPlan, createBattleProfile,
  estimateForecast, levelForXp, recordBattleAttempt, xpToNextLevel, type BattleExam, type BattleMode,
  type BattleProfile, type BattleQuestion,
} from "@/lib/battle";

const profileStorageKey = (uid: string) => `physics-tutor-battle-${uid}`;

function readLocalProfile(uid: string, exam: BattleExam): BattleProfile {
  try {
    const saved = window.localStorage.getItem(profileStorageKey(uid));
    if (saved) return JSON.parse(saved) as BattleProfile;
  } catch { /* local storage can be unavailable */ }
  return createBattleProfile(exam);
}

export default function PhysicsBattle() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<BattleProfile>(() => createBattleProfile());
  const [authReady, setAuthReady] = useState(false);
  const [selectedMode, setSelectedMode] = useState<BattleMode | null>(null);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [answer, setAnswer] = useState("");
  const [lastResult, setLastResult] = useState<{ correct: boolean; question: BattleQuestion } | null>(null);
  const [challengeDone, setChallengeDone] = useState(false);
  const [showExamPicker, setShowExamPicker] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => onAuthStateChanged(auth, async currentUser => {
    setUser(currentUser);
    setAuthReady(true);
    if (!currentUser) return;
    const local = readLocalProfile(currentUser.uid, "ЕГЭ");
    setProfile(local);
    try {
      const snapshot = await getDoc(doc(db, "battleProfiles", currentUser.uid));
      if (snapshot.exists()) setProfile(snapshot.data() as BattleProfile);
    } catch { /* local progress remains available when Firestore rules are not configured */ }
  }), []);

  useEffect(() => {
    if (!user) return;
    try { window.localStorage.setItem(profileStorageKey(user.uid), JSON.stringify(profile)); } catch { /* storage unavailable */ }
  }, [profile, user]);

  const forecast = useMemo(() => estimateForecast(profile), [profile]);
  const level = levelForXp(profile.xp);
  const levelProgress = xpToNextLevel(profile.xp);
  const plan = useMemo(() => buildPlan(profile), [profile]);
  const activeQuestions = useMemo(() => {
    if (!selectedMode) return [];
    const filtered = battleQuestions.filter(question => question.mode === selectedMode);
    return selectedMode === "boss" ? [...filtered, ...battleQuestions.filter(question => question.mode === "speed").slice(0, 3)] : filtered;
  }, [selectedMode]);
  const activeQuestion = activeQuestions[questionIndex];
  const topicRate = (topic: typeof battleTopics[number]["name"]) => {
    const stats = profile.topics[topic];
    return stats?.attempts ? Math.round(stats.correct / stats.attempts * 100) : 0;
  };

  async function persist(next: BattleProfile) {
    setProfile(next);
    if (!user) return;
    setSaving(true);
    try { await setDoc(doc(db, "battleProfiles", user.uid), next, { merge: true }); } catch { /* local-first UX */ }
    finally { setSaving(false); }
  }

  function startMode(mode: BattleMode) {
    setSelectedMode(mode);
    setQuestionIndex(0);
    setAnswer("");
    setLastResult(null);
    setChallengeDone(false);
  }

  function submitAnswer() {
    if (!activeQuestion || lastResult) return;
    const correct = answerIsCorrect(activeQuestion, answer);
    void persist(recordBattleAttempt(profile, activeQuestion, correct));
    setLastResult({ correct, question: activeQuestion });
  }

  function nextQuestion() {
    if (questionIndex >= activeQuestions.length - 1) {
      setChallengeDone(true);
      return;
    }
    setQuestionIndex(index => index + 1);
    setAnswer("");
    setLastResult(null);
  }

  if (!authReady) return <main className="battle-app battle-loading"><span className="battle-pulse" />Загружаем баттл…</main>;
  if (!user) return <main className="battle-app battle-auth"><div className="battle-auth-card"><span className="battle-kicker">PHYSICS TUTOR / ARENA</span><h1>Физический баттл ждёт тебя.</h1><p>Войди в кабинет ученика, чтобы сохранять XP, прогноз и путь к цели.</p><Link className="battle-primary" href="/#login">Войти в кабинет</Link></div></main>;

  return (
    <main className="battle-app">
      <div className="battle-noise" />
      <header className="battle-header">
        <Link className="battle-back" href="/student">← Кабинет</Link>
        <div className="battle-brand"><span className="battle-brand-mark">φ</span><span>PHYSICS BATTLE</span></div>
        <div className="battle-header-stats"><span><b>{profile.xp}</b> XP</span><span><b>{profile.coins}</b> монет</span><span className="battle-level">LVL {level}</span></div>
      </header>

      <section className="battle-hero">
        <div><span className="battle-kicker">ТВОЙ МАРШРУТ · {profile.exam}</span><h1>Не угадывай<br /><em>свой результат.</em></h1><p>Проходи короткие испытания, собирай честную статистику и двигайся к баллу, который нужен именно тебе.</p><div className="battle-hero-actions"><button className="battle-primary" type="button" onClick={() => document.getElementById("battle-modes")?.scrollIntoView({ behavior: "smooth" })}>Начать раунд <span>↗</span></button><button className="battle-quiet" type="button" onClick={() => setShowExamPicker(true)}>Экзамен: {profile.exam} · сменить</button></div></div>
        <div className="battle-orbit"><div className="battle-orbit-ring ring-one" /><div className="battle-orbit-ring ring-two" /><div className="battle-orbit-core">{profile.exam === "ЕГЭ" ? "100" : "5"}<small>ЦЕЛЬ</small></div><span className="orbit-label label-one">точность</span><span className="orbit-label label-two">ритм</span><span className="orbit-label label-three">рост</span></div>
      </section>

      <section className="battle-grid battle-forecast-grid">
        <article className="battle-panel forecast-panel"><div className="battle-panel-head"><div><span className="battle-kicker">МОЙ ПУТЬ К {profile.exam === "ЕГЭ" ? "100" : "5"} БАЛЛАМ</span><h2>{forecast.ready ? `${forecast.score} / 100` : "— / 100"}</h2></div><span className={`confidence-pill ${forecast.ready ? "ready" : "muted"}`}>{forecast.label}</span></div><div className="forecast-range"><span>{forecast.ready ? `Диапазон ${forecast.low}–${forecast.high}` : "Сделай ещё несколько раундов"}</span><span>{forecast.ready ? `${forecast.confidence}% уверенности` : "Нужно минимум 5 попыток"}</span></div><div className="forecast-bar"><i style={{ width: `${forecast.ready ? forecast.score : 8}%` }} /></div><div className="forecast-foot"><span>{forecast.ready ? `До цели осталось ${Math.max(0, 90 - forecast.score)} баллов` : "Прогноз появится после первых результатов"}</span><span className="forecast-spark">↗</span></div></article>
        <article className="battle-panel level-panel"><span className="battle-kicker">ТЕКУЩИЙ УРОВЕНЬ</span><div className="level-line"><strong>LVL {level}</strong><span>{levelProgress.current} / {levelProgress.needed} XP</span></div><div className="forecast-bar"><i style={{ width: `${Math.round(levelProgress.current / levelProgress.needed * 100)}%` }} /></div><p>Ещё {Math.max(0, levelProgress.needed - levelProgress.current)} XP до следующего ранга.</p><div className="streak-row"><span className="streak-flame">✦</span><div><b>{profile.streak} дней</b><small>текущая серия занятий</small></div><div className="streak-best"><b>{profile.bestStreak}</b><small>рекорд серии</small></div></div></article>
      </section>

      <section id="battle-modes" className="battle-section"><div className="battle-section-head"><div><span className="battle-kicker">ПЯТЬ РЕЖИМОВ</span><h2>Выбери свой темп.</h2></div><span className="battle-section-note">Каждый правильный ответ двигает прогноз</span></div><div className="battle-mode-grid">{battleModes.map(mode => <button type="button" key={mode.id} className="battle-mode-card" style={{ "--mode-accent": mode.accent } as React.CSSProperties} onClick={() => startMode(mode.id)}><span className="mode-index">{String(battleModes.indexOf(mode) + 1).padStart(2, "0")}</span><span className="mode-icon">{mode.icon}</span><h3>{mode.title}</h3><p>{mode.description}</p><span className="mode-meta">{mode.meta} <b>→</b></span></button>)}</div></section>

      <section className="battle-grid battle-lower-grid"><article className="battle-panel knowledge-panel"><div className="battle-panel-head"><div><span className="battle-kicker">КАРТА ЗНАНИЙ</span><h2>Твои разделы.</h2></div><span className="map-legend"><i className="legend-blue" />в работе <i className="legend-green" />сильная</span></div><div className="battle-topic-list">{battleTopics.map(topic => { const rate = topicRate(topic.name); return <div className="battle-topic-row" key={topic.name}><span className="topic-symbol" style={{ color: topic.accent }}>{topic.symbol}</span><div className="topic-copy"><div><b>{topic.name}</b><small>{profile.topics[topic.name]?.attempts || 0} попыток</small></div><div className="topic-progress"><i style={{ width: `${Math.max(rate, 4)}%`, background: topic.accent }} /></div></div><strong>{rate}%</strong></div>; })}</div></article><article className="battle-panel plan-panel"><div className="battle-panel-head"><div><span className="battle-kicker">ПЛАН НА СЕГОДНЯ</span><h2>Три шага.</h2></div><span className="daily-count">{profile.dailyCompleted}/{profile.dailyGoal}</span></div><div className="daily-track"><i style={{ width: `${Math.min(100, profile.dailyCompleted / profile.dailyGoal * 100)}%` }} /></div><div className="plan-list">{plan.map((item, index) => <button type="button" key={item.topic} onClick={() => startMode(index === 0 ? "streak" : "formulas")}><span>{String(index + 1).padStart(2, "0")}</span><div><b>{item.topic}</b><small>{item.rate ? `${item.rate}% · ${item.text}` : item.text}</small></div><em>→</em></button>)}</div><div className="recommendation"><span>СИГНАЛ</span><p>{plan[0]?.rate && plan[0].rate < 60 ? `Результаты по теме «${plan[0].topic}» просели. Начни с короткой серии, чтобы вернуть ритм.` : "Ты держишь хороший темп. Добавь один сложный раунд, чтобы проверить себя."}</p></div></article></section>

      <section className="battle-activity"><div className="battle-section-head"><div><span className="battle-kicker">ДИНАМИКА</span><h2>Последние попытки.</h2></div><span className="battle-section-note">XP · точность · стабильность</span></div><div className="activity-chart">{Array.from({ length: 12 }).map((_, index) => { const attempt = profile.attempts[profile.attempts.length - 12 + index]; const height = attempt ? Math.max(12, attempt.correct ? 48 + attempt.difficulty * 13 : 18) : 8; return <div className="activity-column" key={index}><i className={attempt?.correct ? "correct" : attempt ? "wrong" : "empty"} style={{ height: `${height}%` }} /><small>{attempt ? attempt.score : ""}</small></div>; })}</div></section>

      {showExamPicker && <div className="battle-modal-backdrop" role="presentation" onClick={() => setShowExamPicker(false)}><div className="battle-modal" role="dialog" aria-modal="true" onClick={event => event.stopPropagation()}><span className="battle-kicker">НАСТРОЙКА МАРШРУТА</span><h2>К какому экзамену идём?</h2><p>Режимы и прогноз используют выбранную цель. Ты можешь поменять её в любой момент.</p><div className="exam-choice-grid">{(["ОГЭ", "ЕГЭ"] as BattleExam[]).map(exam => <button type="button" key={exam} className={profile.exam === exam ? "selected" : ""} onClick={() => { void persist({ ...profile, exam }); setShowExamPicker(false); }}><b>{exam}</b><span>{exam === "ЕГЭ" ? "11 класс · шкала до 100" : "9 класс · шкала до 5"}</span></button>)}</div><button type="button" className="battle-quiet modal-close" onClick={() => setShowExamPicker(false)}>Закрыть</button></div></div>}
      {selectedMode && activeQuestion && !challengeDone && <div className="battle-modal-backdrop" role="presentation"><div className="battle-challenge" role="dialog" aria-modal="true"><div className="challenge-top"><span className="battle-kicker">{battleModes.find(mode => mode.id === selectedMode)?.title}</span><button type="button" className="challenge-close" onClick={() => setSelectedMode(null)}>×</button></div><div className="challenge-meta"><span>{questionIndex + 1} / {activeQuestions.length}</span><span>{activeQuestion.topic} · сложность {activeQuestion.difficulty}/3</span></div><h2>{activeQuestion.prompt}</h2>{activeQuestion.mode === "mistake" && activeQuestion.mistake && <div className="mistake-callout"><span>ОШИБКА В РЕШЕНИИ</span>{activeQuestion.mistake}</div>}<label className="challenge-answer">Твой ответ<input autoFocus value={answer} onChange={event => setAnswer(event.target.value)} onKeyDown={event => { if (event.key === "Enter") submitAnswer(); }} placeholder="Напиши число или короткий ответ" disabled={Boolean(lastResult)} /></label>{lastResult ? <div className={`challenge-result ${lastResult.correct ? "success" : "error"}`}><b>{lastResult.correct ? "Точно. Ответ принят." : "Пока нет. Разберём шаг."}</b><p>{activeQuestion.explanation}</p><small>{activeQuestion.formula}</small><button type="button" className="battle-primary" onClick={nextQuestion}>{questionIndex >= activeQuestions.length - 1 ? "Завершить раунд" : "Следующая задача →"}</button></div> : <button type="button" className="battle-primary challenge-submit" onClick={submitAnswer} disabled={!answer.trim()}>Проверить ответ <span>↗</span></button>}</div></div>}
      {selectedMode && challengeDone && <div className="battle-modal-backdrop" role="presentation"><div className="battle-challenge challenge-finished" role="dialog" aria-modal="true"><span className="battle-kicker">РАУНД ЗАВЕРШЁН</span><h2>Хорошая работа.</h2><p>Результат уже добавлен в твою карту знаний. Следующий шаг — короткая пауза и новый режим.</p><div className="finished-stats"><div><b>{profile.attempts.slice(-activeQuestions.length).filter(attempt => attempt.correct).length}</b><span>верных</span></div><div><b>+{profile.attempts.slice(-activeQuestions.length).reduce((sum, attempt) => sum + attempt.score, 0)}</b><span>XP</span></div><div><b>{profile.streak}</b><span>серия</span></div></div><button type="button" className="battle-primary" onClick={() => setSelectedMode(null)}>Вернуться к карте</button></div></div>}
      {saving && <div className="battle-save-indicator">Сохраняем прогресс…</div>}
    </main>
  );
}
