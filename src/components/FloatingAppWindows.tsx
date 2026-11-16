"use client";

import { useState, type ReactNode } from "react";
import { gradeNumericAnswer } from "@/lib/grading";
import { battleQuestions } from "@/lib/battle";
import { PhysicsIcon } from "./PhysicsMark";
import { AnimatedNumber, MotionScene, Tilt } from "./PremiumMotion";
import s from "./PhysicsLanding.module.css";

// Lightweight, public replicas of QuestionTrainer, PhysicsOverview and BattleTrainer.
// No authentication, storage, telemetry or student records are read or written.
function Window({ title, children, className }: { title: string; children: ReactNode; className: string }) {
  return <div className={`${s.windowPosition} ${className}`}><Tilt className={s.window}><div className={s.windowBar}><span aria-hidden="true" className={s.windowDots}>● ● ●</span><span>{title}</span><small>ДЕМО</small></div>{children}</Tilt></div>;
}

export default function FloatingAppWindows() {
  const question = battleQuestions.find(item => item.id === "mechanics-force")!;
  const [answer, setAnswer] = useState("");
  const [result, setResult] = useState<{ correct: boolean; message: string } | null>(null);
  return <MotionScene className={s.scene}>
    <div className={s.sceneGrid} aria-hidden="true" />
    <Tilt className={s.atom} ><div className={s.atomCore}>φ</div><i /><i /><i /><span className={s.particle} /></Tilt>
    <Window title="Кабинет ученика" className={s.dashboardWindow}>
      <div className={s.miniDashboard}><aside><b>φ</b><span className={s.activeNav}>Обзор</span><span>Задания</span><span>Тренажёры</span><span>Расписание</span></aside><div><p className={s.eyebrow}>ТВОЯ УЧЕБНАЯ ОРБИТА</p><h3>Продолжим открывать физику</h3><div className={s.studyFeature}><span>МЕХАНИКА</span><strong>Законы Ньютона</strong><em>F = ma</em></div><div className={s.miniMetrics}><span><b>8 / 12</b>Проверено заданий</span><span><b>3 дня</b>Серия занятий</span><span><b>80%</b>Средний результат</span></div></div></div>
    </Window>
    <Window title="Тренажёр ЕГЭ · Механика" className={s.trainerWindow}>
      <form className={s.windowBody} onSubmit={event => { event.preventDefault(); const grade = gradeNumericAnswer(answer, Number(question.answer)); setResult({ correct: grade.correct, message: grade.correct ? `Верно! ${question.explanation}` : grade.reason || "Пока не сходится. Подсказка: раздели силу на массу." }); }}>
        <div className={s.labelRow}><span className={s.pill}>Числовой ответ</span><span>01 / 05</span></div><h3>Сила и ускорение</h3><p>{question.prompt} Ответ дайте в м/с².</p><div className={s.formula}>{question.formula}</div><label htmlFor="hero-answer">Твой ответ, м/с²</label><div className={s.answerRow}><input id="hero-answer" inputMode="decimal" autoComplete="off" placeholder="Например, 4" value={answer} onChange={event => { setAnswer(event.target.value); setResult(null); }} /><button type="submit">Проверить <span aria-hidden="true">↗</span></button></div><div className={`${s.feedback} ${result?.correct ? s.correct : ""}`} role="status">{result?.message || "Попробуй решить — ответ проверяется прямо здесь."}</div>
      </form>
    </Window>
    <Window title="Прогресс обучения" className={s.statsWindow}>
      <div className={s.windowBody}><div className={s.statHeading}><div><p>Средний результат</p><strong><AnimatedNumber value={80}/><span>%</span></strong></div><svg className={s.progressRing} viewBox="0 0 80 80" role="img" aria-label="Пример: 8 из 12 заданий проверено"><circle cx="40" cy="40" r="31" /><circle cx="40" cy="40" r="31" pathLength="100" strokeDasharray="67 100" /><text x="40" y="44" textAnchor="middle">8/12</text></svg></div><svg className={s.chart} viewBox="0 0 260 85" role="img" aria-label="Пример результатов пяти попыток: 40, 60, 50, 70 и 80 процентов"><path d="M0 20H260M0 50H260M0 80H260" className={s.chartGrid}/><path d="M8 68 66 45 126 56 187 32 250 20" className={s.chartLine}/>{[[8,68],[66,45],[126,56],[187,32],[250,20]].map(([x,y]) => <circle key={x} cx={x} cy={y} r="3" fill="#38bdf8" />)}</svg><div className={s.labelRow}><span>Попытка 1</span><span>Попытка 5</span></div></div>
    </Window>
    <Window title="Домашнее задание" className={s.homeworkWindow}>
      <div className={s.windowBody}><div className={s.homeworkIcon}><PhysicsIcon name="tasks" size={22}/></div><h3>Законы Ньютона</h3><p>5 задач на второй закон Ньютона</p><div className={s.labelRow}><span className={s.pill}>Не начато</span><span>До 20 ноября · пример</span></div><a href="#login" className={s.windowLink}>Открыть задание <span aria-hidden="true">↗</span></a></div>
    </Window>
    <Window title="Физический баттл" className={s.achievementWindow}>
      <div className={s.achievement}><span aria-hidden="true">✧</span><div><small>ДОСТИЖЕНИЕ · ПРИМЕР</small><h3>Пять подряд</h3><p>5 правильных ответов без ошибок</p></div></div>
    </Window>
    <p className={s.sceneCaption}>ЖИВОЙ ИНТЕРФЕЙС · ПРИМЕРНЫЕ ДАННЫЕ · БЕЗ СОХРАНЕНИЯ</p>
  </MotionScene>;
}
