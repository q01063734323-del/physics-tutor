"use client";

import { useEffect, useMemo, useState, type PointerEvent } from "react";
import {
  defaultKinematicPoints, deriveAll, displacement, directionChanges,
  generateEgeTasks, graphLabels, pathLength, stoppingTimes, type EgeTask, type GraphKind, type KinematicPoint, validatePoints,
} from "@/lib/kinematics";

type LabMode = "theory" | "builder" | "tasks" | "exam" | "learn";

const modes: Array<[LabMode, string]> = [
  ["theory", "Теория"], ["builder", "Конструктор графиков"], ["tasks", "Практика ЕГЭ"],
  ["exam", "Экзамен"], ["learn", "Разобрать график"],
];

function formatNumber(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/.?0+$/, "");
}

function GraphCanvas({ kind, points, editable, onMove }: { kind: GraphKind; points: KinematicPoint[]; editable?: boolean; onMove?: (index: number, point: KinematicPoint) => void }) {
  const width = 620;
  const height = 300;
  const pad = { left: 48, right: 18, top: 20, bottom: 38 };
  const maxT = Math.max(6, ...points.map(point => point.t));
  const values = points.map(point => point.value);
  const maxAbs = Math.max(2, ...values.map(value => Math.abs(value)));
  const x = (time: number) => pad.left + (time / maxT) * (width - pad.left - pad.right);
  const y = (value: number) => pad.top + ((maxAbs - value) / (maxAbs * 2)) * (height - pad.top - pad.bottom);
  const path = points.map((point, index) => (index ? "L" : "M") + x(point.t) + "," + y(point.value)).join(" ");
  const gridX = Array.from({ length: Math.floor(maxT) + 1 }, (_, index) => index);
  const gridY = Array.from({ length: 5 }, (_, index) => maxAbs - (index * maxAbs) / 2);
  function move(event: PointerEvent<SVGCircleElement>, index: number) {
    if (!editable || !onMove) return;
    const svg = event.currentTarget.ownerSVGElement;
    const rect = svg?.getBoundingClientRect();
    if (!rect) return;
    const nextT = Math.max(0, Math.min(maxT, ((event.clientX - rect.left) / rect.width) * width - pad.left) / (width - pad.left - pad.right) * maxT);
    const nextValue = maxAbs - (((event.clientY - rect.top) / rect.height) * height - pad.top) / (height - pad.top - pad.bottom) * maxAbs * 2;
    onMove(index, { t: Number(nextT.toFixed(2)), value: Number(nextValue.toFixed(2)) });
  }
  return <svg className="kin-graph" viewBox={"0 0 " + width + " " + height} role="img" aria-label={graphLabels[kind].title}>
    {gridX.map(value => <line key={"x" + value} x1={x(value)} x2={x(value)} y1={pad.top} y2={height - pad.bottom} className="kin-grid" />)}
    {gridY.map((value, index) => <line key={"y" + index} x1={pad.left} x2={width - pad.right} y1={y(value)} y2={y(value)} className="kin-grid" />)}
    <line x1={pad.left} x2={width - pad.right} y1={y(0)} y2={y(0)} className="kin-axis" />
    <line x1={pad.left} x2={pad.left} y1={pad.top} y2={height - pad.bottom} className="kin-axis" />
    <path d={path} className="kin-line" />
    {points.map((point, index) => <circle key={index} cx={x(point.t)} cy={y(point.value)} r={editable ? 7 : 4} className={editable ? "kin-point editable" : "kin-point"} onPointerMove={event => event.buttons === 1 && move(event, index)} onPointerDown={event => editable && event.currentTarget.setPointerCapture(event.pointerId)} />)}
    <text x={width - pad.right - 10} y={height - 10} className="kin-label">t, с</text>
    <text x={10} y={pad.top + 6} className="kin-label">{graphLabels[kind].axis + ", " + graphLabels[kind].unit}</text>
  </svg>;
}

function SeriesCard({ kind, points, editable, onMove }: { kind: GraphKind; points: KinematicPoint[]; editable?: boolean; onMove?: (index: number, point: KinematicPoint) => void }) {
  return <article className="kin-series-card">
    <div className="kin-card-head"><div><span className="eyebrow">{graphLabels[kind].unit}</span><h4>{graphLabels[kind].title}</h4></div><span className="kin-card-state">{editable ? "Изменяется" : "Рассчитан"}</span></div>
    <GraphCanvas kind={kind} points={points} editable={editable} onMove={onMove} />
  </article>;
}

function NumberInput({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return <label className="kin-field">{label}<input type="number" step="0.1" value={value} onChange={event => onChange(Number(event.target.value))} /></label>;
}

function savedBuilder() {
  if (typeof window === "undefined") return { source: "x" as GraphKind, points: defaultKinematicPoints, x0: 0, v0: 0 };
  try {
    const parsed = JSON.parse(window.localStorage.getItem("physics-tutor-kinematics-builder") || "null") as { source?: GraphKind; points?: KinematicPoint[]; x0?: number; v0?: number } | null;
    return {
      source: parsed?.source || "x",
      points: Array.isArray(parsed?.points) && parsed.points.length >= 2 ? parsed.points : defaultKinematicPoints,
      x0: typeof parsed?.x0 === "number" ? parsed.x0 : 0,
      v0: typeof parsed?.v0 === "number" ? parsed.v0 : 0,
    };
  } catch { return { source: "x" as GraphKind, points: defaultKinematicPoints, x0: 0, v0: 0 }; }
}

function TaskCard({ task, onComplete }: { task: EgeTask; onComplete: (correct: boolean) => void }) {
  const [answer, setAnswer] = useState("");
  const [result, setResult] = useState<boolean | null>(null);
  return <article className="kin-task-card"><div className="kin-task-meta"><span>{task.topic}</span><span>Ответ в {task.unit}</span></div><h4>{task.title}</h4><p>{task.prompt}</p><label className="kin-field">Ответ<input inputMode="decimal" value={answer} onChange={event => { setAnswer(event.target.value); setResult(null); }} placeholder="Например, 12" /></label><button type="button" className="primary" onClick={() => { const actual = Number(answer.replace(",", ".")); const correct = Number.isFinite(actual) && Math.abs(actual - task.answer) <= 0.05; setResult(correct); onComplete(correct); }}>Проверить</button>{result !== null && <div className={"answer-feedback " + (result ? "success" : "error")}><b>{result ? "Верно" : "Есть ошибка"}</b><p>{result ? task.explanation : "Проверьте знак, единицы и формулу. " + task.explanation}</p></div>}</article>;
}

export default function KinematicsLab() {
  const [mode, setMode] = useState<LabMode>("builder");
  const [initialBuilder] = useState(savedBuilder);
  const [source, setSource] = useState<GraphKind>(initialBuilder.source);
  const [points, setPoints] = useState<KinematicPoint[]>(initialBuilder.points);
  const [x0, setX0] = useState(initialBuilder.x0);
  const [v0, setV0] = useState(initialBuilder.v0);
  const [selectedGraph, setSelectedGraph] = useState<GraphKind>("x");
  const [taskIndex, setTaskIndex] = useState(0);
  const [taskScore, setTaskScore] = useState(0);
  const [examTasks, setExamTasks] = useState<EgeTask[]>(() => generateEgeTasks(6));
  const [examAnswers, setExamAnswers] = useState<Record<string, string>>({});
  const [examIndex, setExamIndex] = useState(0);
  const [examFinished, setExamFinished] = useState(false);
  const [seconds, setSeconds] = useState(25 * 60);
  const [checkMessage, setCheckMessage] = useState("");

  useEffect(() => {
    window.localStorage.setItem("physics-tutor-kinematics-builder", JSON.stringify({ source, points, x0, v0 }));
  }, [source, points, x0, v0]);

  const derived = useMemo(() => deriveAll(source, points, { x0, v0 }), [source, points, x0, v0]);
  const analysis = useMemo(() => ({
    displacement: displacement(derived.v),
    path: pathLength(derived.v),
    stops: stoppingTimes(derived.v),
    turns: directionChanges(derived.v),
  }), [derived.v]);
  const tasks = useMemo(() => generateEgeTasks(8, taskIndex + 11), [taskIndex]);

  useEffect(() => {
    if (mode !== "exam" || examFinished) return;
    const timer = window.setInterval(() => setSeconds(value => {
      if (value <= 1) { setExamFinished(true); return 0; }
      return value - 1;
    }), 1000);
    return () => window.clearInterval(timer);
  }, [mode, examFinished]);

  function movePoint(index: number, next: KinematicPoint) {
    setPoints(current => current.map((point, pointIndex) => pointIndex === index ? next : point).sort((a, b) => a.t - b.t));
    setCheckMessage("");
  }

  function addPoint() {
    const last = points.at(-1) ?? { t: 0, value: 0 };
    setPoints(current => [...current, { t: last.t + 2, value: last.value }]);
  }

  function checkBuilder() {
    const result = validatePoints(points);
    setCheckMessage(result.valid ? "График согласован с физической моделью." : result.errors.join(" "));
  }

  function resetExam() {
    setExamTasks(generateEgeTasks(6, Date.now()));
    setExamAnswers({});
    setExamIndex(0);
    setExamFinished(false);
    setSeconds(25 * 60);
  }

  const currentExam = examTasks[examIndex];
  const examCorrect = examTasks.filter(task => Math.abs(Number(examAnswers[task.id]?.replace(",", ".")) - task.answer) <= 0.05).length;
  const examMinutes = Math.floor((25 * 60 - seconds) / 60);
  const examSeconds = (25 * 60 - seconds) % 60;

  return <section className="kinematics-lab">
    <header className="kin-header"><div><div className="eyebrow">КИНЕМАТИКА · ЛАБОРАТОРИЯ</div><h2>Графики движения</h2><p>Стройте x(t), v(t) и a(t), а система проверит производные, интегралы и физический смысл.</p></div><span className="tag ready">Математическая модель</span></header>
    <nav className="kin-mode-tabs" aria-label="Режимы лаборатории">{modes.map(([id, label]) => <button key={id} type="button" className={mode === id ? "selected" : ""} onClick={() => setMode(id)}>{label}</button>)}</nav>
    {mode === "theory" && <div className="kin-theory"><h3>Связь трёх графиков</h3><div className="kin-theory-grid"><article><b>x(t) → v(t)</b><p>Скорость — наклон графика координаты. Наклон вверх означает положительную скорость.</p></article><article><b>v(t) → a(t)</b><p>Ускорение — наклон графика скорости. Площадь под v(t) равна перемещению.</p></article><article><b>a(t) → v(t), x(t)</b><p>Интегрирование ускорения даёт изменение скорости, а повторное интегрирование — координату.</p></article></div><div className="kin-invariants"><span>v = dx/dt</span><span>a = dv/dt</span><span>Δx = ∫v(t)dt</span><span>Δv = ∫a(t)dt</span></div></div>}
    {mode === "builder" && <div className="kin-builder">
      <div className="kin-builder-controls"><div className="kin-control-row"><label className="kin-field">Исходный график<select value={source} onChange={event => setSource(event.target.value as GraphKind)}><option value="x">x(t) — координата</option><option value="v">v(t) — скорость</option><option value="a">a(t) — ускорение</option></select></label><NumberInput label="x₀, м" value={x0} onChange={setX0} /><NumberInput label="v₀, м/с" value={v0} onChange={setV0} /></div><div className="kin-control-row"><button type="button" className="primary" onClick={addPoint}>Добавить участок</button><button type="button" className="secondary" disabled={points.length <= 2} onClick={() => setPoints(current => current.slice(0, -1))}>Удалить точку</button><button type="button" className="secondary" onClick={() => { setPoints(defaultKinematicPoints); setCheckMessage(""); }}>Сбросить</button><button type="button" className="secondary" onClick={() => setMode("learn")}>Разобрать график</button></div></div>
      <div className="kin-series-grid">{(["x", "v", "a"] as GraphKind[]).map(kind => <SeriesCard key={kind} kind={kind} points={derived[kind]} editable={kind === source} onMove={movePoint} />)}</div>
      <div className="kin-analysis"><div><span className="eyebrow">Проверка модели</span><h3>{checkMessage || "Перемещайте точки мышью или меняйте исходный график."}</h3><button type="button" className="primary" onClick={checkBuilder}>Проверить согласованность</button></div><dl><div><dt>Перемещение</dt><dd>{formatNumber(analysis.displacement)} м</dd></div><div><dt>Путь</dt><dd>{formatNumber(analysis.path)} м</dd></div><div><dt>Остановки</dt><dd>{analysis.stops.length ? analysis.stops.map(formatNumber).join(", ") + " с" : "нет"}</dd></div><div><dt>Смена направления</dt><dd>{analysis.turns.length ? analysis.turns.map(formatNumber).join(", ") + " с" : "нет"}</dd></div></dl></div>
    </div>}
    {mode === "tasks" && <div className="kin-practice"><div className="kin-practice-head"><div><span className="eyebrow">Авторские задачи ЕГЭ</span><h3>Построение и анализ графиков</h3></div><span className="results-count">{taskScore} верно</span></div><TaskCard task={tasks[taskIndex % tasks.length]} onComplete={correct => { if (correct) setTaskScore(value => value + 1); }} /><button type="button" className="secondary" onClick={() => setTaskIndex(value => value + 1)}>Следующая задача →</button></div>}
    {mode === "learn" && <div className="kin-learn"><div className="kin-learn-select">{(["x", "v", "a"] as GraphKind[]).map(kind => <button key={kind} type="button" className={selectedGraph === kind ? "selected" : ""} onClick={() => setSelectedGraph(kind)}>{graphLabels[kind].title}</button>)}</div><SeriesCard kind={selectedGraph} points={derived[selectedGraph]} /><ol className="kin-steps"><li><b>Оси</b><span>По горизонтали время t в секундах, по вертикали {graphLabels[selectedGraph].axis} в {graphLabels[selectedGraph].unit}.</span></li><li><b>Участки</b><span>Наклон линии показывает {selectedGraph === "x" ? "скорость" : selectedGraph === "v" ? "ускорение" : "изменение ускорения"}.</span></li><li><b>Остановка и направление</b><span>{analysis.stops.length ? "Нулевая скорость на " + analysis.stops.map(formatNumber).join(", ") + " с." : "Нулевых значений скорости на текущем графике нет."} {analysis.turns.length ? "Смена направления в " + analysis.turns.map(formatNumber).join(", ") + " с." : ""}</span></li><li><b>Площадь</b><span>Площадь под v(t) даёт перемещение, сумма модулей площадей — путь.</span></li></ol></div>}
    {mode === "exam" && <div className="kin-exam">{!examFinished ? <><div className="kin-exam-head"><div><span className="eyebrow">РЕЖИМ ЕГЭ</span><h3>Вариант · вопрос {examIndex + 1} из {examTasks.length}</h3></div><span className="exam-timer">{String(Math.floor(seconds / 60)).padStart(2, "0")}:{String(seconds % 60).padStart(2, "0")}</span></div><div className="kin-exam-progress"><i style={{ width: ((examIndex + 1) / examTasks.length * 100) + "%" }} /></div><div className="kin-exam-question"><span className="tag ready">{currentExam.topic}</span><h4>{currentExam.prompt}</h4><label className="kin-field">Ответ ({currentExam.unit})<input inputMode="decimal" value={examAnswers[currentExam.id] || ""} onChange={event => setExamAnswers(current => ({ ...current, [currentExam.id]: event.target.value }))} /></label></div><div className="kin-exam-actions"><button type="button" className="secondary" disabled={examIndex === 0} onClick={() => setExamIndex(value => value - 1)}>← Назад</button>{examIndex < examTasks.length - 1 ? <button type="button" className="primary" onClick={() => setExamIndex(value => value + 1)}>Дальше →</button> : <button type="button" className="primary" onClick={() => setExamFinished(true)}>Завершить</button>}<button type="button" className="secondary" onClick={() => setExamFinished(true)}>Завершить сейчас</button></div></> : <div className="kin-exam-result"><span className="eyebrow">РЕЗУЛЬТАТ ВАРИАНТА</span><h3>{examCorrect} из {examTasks.length}</h3><p>{Math.round(examCorrect / examTasks.length * 100)}% правильных ответов · время {examMinutes}:{String(examSeconds).padStart(2, "0")}</p><div className="kin-review"><b>Что повторить</b><span>{examCorrect < examTasks.length ? "Скорость по графику, площади под v(t) и знаки величин." : "Отлично. Переходите к задачам с несколькими участками."}</span></div><button type="button" className="primary" onClick={resetExam}>Новый вариант</button></div>}</div>}
  </section>;
}
