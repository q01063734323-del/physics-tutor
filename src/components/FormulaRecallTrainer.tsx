"use client";

import { useEffect, useMemo, useState } from "react";
import { validateFormula } from "@/lib/formulaValidator";
import { applyFormulaAnswer, createFormulaAttempt, type FormulaAttempt } from "@/lib/formulaTrainer";

type Card = { id: string; topic: string; title: string; prompt: string; formula: string; hint: string };
type Progress = Record<string, { attempts: number; correct: number; lastSeen: string }>;

const cards: Card[] = [
  { id: "momentum", topic: "Механика", title: "Импульс тела", prompt: "Из каких физических величин состоит импульс тела? Запиши формулу", formula: "p = mv", hint: "Импульс равен произведению массы на скорость." },
  { id: "newton2", topic: "Механика", title: "Второй закон Ньютона", prompt: "Запиши формулу силы через массу и ускорение", formula: "F = ma", hint: "Сила равна произведению массы на ускорение." },
  { id: "speed", topic: "Механика", title: "Скорость", prompt: "Как найти скорость через путь и время?", formula: "v = s / t", hint: "Раздели пройденный путь на время движения." },
  { id: "kinetic", topic: "Механика", title: "Кинетическая энергия", prompt: "Запиши энергию движущегося тела", formula: "E = mv² / 2", hint: "В формуле есть масса и квадрат скорости." },
  { id: "density", topic: "Молекулярная физика", title: "Плотность", prompt: "Как выразить плотность вещества?", formula: "ρ = m / V", hint: "Плотность — масса единицы объёма." },
  { id: "heat", topic: "Термодинамика", title: "Количество теплоты", prompt: "Запиши формулу нагревания тела", formula: "Q = cmΔt", hint: "Умножь теплоёмкость, массу и изменение температуры." },
  { id: "power", topic: "Электродинамика", title: "Мощность тока", prompt: "Как найти мощность по напряжению и току?", formula: "P = UI", hint: "Мощность — произведение напряжения на силу тока." },
  { id: "ohm", topic: "Электродинамика", title: "Закон Ома", prompt: "Запиши силу тока через напряжение и сопротивление", formula: "I = U / R", hint: "Напряжение делится на сопротивление." },
  { id: "potential", topic: "Механика", title: "Потенциальная энергия", prompt: "Запиши энергию тела на высоте", formula: "E = mgh", hint: "Масса умножается на ускорение свободного падения и высоту." },
  { id: "force", topic: "Механика", title: "Сила упругости", prompt: "Как записывается закон Гука?", formula: "F = kx", hint: "Жёсткость умножается на деформацию." },
  { id: "lens", topic: "Оптика", title: "Тонкая линза", prompt: "Запиши формулу линзы", formula: "1/F = 1/d + 1/f", hint: "Оптическая сила связана с расстояниями до предмета и изображения." },
];

export default function FormulaRecallTrainer() {
  const [mode, setMode] = useState<"recall" | "choice" | "fix">("recall");
  const [section, setSection] = useState("Все разделы");
  const [progress, setProgress] = useState<Progress>(() => { if (typeof window === "undefined") return {}; try { const saved = window.localStorage.getItem("physics-tutor-formula-progress"); return saved ? JSON.parse(saved) as Progress : {}; } catch { return {}; } });
  const [streak, setStreak] = useState(0);
  const [index, setIndex] = useState(0);
  const [input, setInput] = useState("");
  const [state, setState] = useState<FormulaAttempt>(createFormulaAttempt());
  const [feedback, setFeedback] = useState<string | null>(null);
  const sections = ["Все разделы", ...Array.from(new Set(cards.map(item => item.topic)))];
  const deck = useMemo(() => section === "Все разделы" ? cards : cards.filter(item => item.topic === section), [section]);
  const card = useMemo(() => deck[index % deck.length], [deck, index]);
  const choices = useMemo(() => [card.formula, cards[(index + 2) % cards.length].formula, cards[(index + 5) % cards.length].formula, cards[(index + 7) % cards.length].formula].sort(() => 0.5 - ((index + 1) % 2)), [card, index]);
  const broken = useMemo(() => card.id === "ohm" ? "I = U · R" : card.id === "speed" ? "v = s · t" : card.id === "kinetic" ? "E = mv / 2" : `${card.formula} + 1`, [card]);
  const currentProgress = progress[card.id] || { attempts: 0, correct: 0, lastSeen: "" };
  const saveProgress = (correct: boolean) => { const now = new Date().toISOString(); setProgress(previous => ({ ...previous, [card.id]: { attempts: (previous[card.id]?.attempts || 0) + 1, correct: (previous[card.id]?.correct || 0) + (correct ? 1 : 0), lastSeen: now } })); setStreak(previous => correct ? previous + 1 : 0); };

  useEffect(() => { try { window.localStorage.setItem("physics-tutor-formula-progress", JSON.stringify(progress)); } catch { /* storage unavailable */ } }, [progress]);

  function check() {
    const phrase = input.toLowerCase().replace(/ё/g, "е");
    const semantic = (card.id === "momentum" && phrase.includes("масса") && phrase.includes("скорост")) || (card.id === "kinetic" && phrase.includes("половин") && phrase.includes("масса") && phrase.includes("квадрат") && phrase.includes("скорост")) || (card.id === "density" && phrase.includes("масса") && (phrase.includes("объем") || phrase.includes("объeм") || phrase.includes("объём")) && (phrase.includes("дел") || phrase.includes("раздел")));
    const result = semantic ? { isValid: true, feedback: card.id === "momentum" ? "Верно! Импульс — произведение массы на скорость." : card.id === "kinetic" ? "Верно! Кинетическая энергия — половина произведения массы на квадрат скорости." : "Верно! Плотность — масса, делённая на объём.", normalizedInput: input, matchedFormula: card.formula } : validateFormula(input, card.id);
    setState(previous => applyFormulaAnswer(previous, result.isValid));
    saveProgress(result.isValid);
    setFeedback(result.isValid ? "Верно! Формула распознана." : "Пока не совпало. Попробуй ещё раз или воспользуйся подсказкой.");
  }

  function choose(value: string) {
    const correct = value === card.formula;
    setState(previous => applyFormulaAnswer(previous, correct));
    saveProgress(correct);
    setFeedback(correct ? "Верно! Отличное узнавание формулы." : "Это другая формула. Проверь смысл вопроса и попробуй ещё раз.");
  }

  function fixFormula() {
    const result = validateFormula(input, card.id);
    setState(previous => applyFormulaAnswer(previous, result.isValid));
    saveProgress(result.isValid);
    setFeedback(result.isValid ? "Исправлено верно!" : "Формула всё ещё содержит ошибку. Проверь знак операции и степень.");
  }

  function next() {
    setIndex(value => (value + 1) % deck.length);
    setInput("");
    setState(createFormulaAttempt());
    setFeedback(null);
  }

  return <div className="formula-recall">
    <div className="formula-recall-head"><div><div className="eyebrow">Активное вспоминание</div><h4>Тренажёр формул</h4><p className="muted">Один вопрос за раз. Запиши формулу своими словами или математически.</p></div><span className="tag ready">{index % deck.length + 1} / {deck.length}</span></div><label className="formula-section-select">Раздел<select value={section} onChange={event => { setSection(event.target.value); setIndex(0); setState(createFormulaAttempt()); setFeedback(null); setInput(""); }}>{sections.map(item => <option key={item}>{item}</option>)}</select></label><div className="formula-recall-stats"><span>Попыток: <b>{currentProgress.attempts}</b></span><span>Верно: <b>{currentProgress.correct}</b></span><span>Серия: <b>{streak} 🔥</b></span></div>
    <div className="formula-recall-tabs"><button className={mode === "recall" ? "selected" : ""} onClick={() => { setMode("recall"); setFeedback(null); }}>Вспомнить самому</button><button className={mode === "choice" ? "selected" : ""} onClick={() => { setMode("choice"); setFeedback(null); }}>Выбрать вариант</button><button className={mode === "fix" ? "selected" : ""} onClick={() => { setMode("fix"); setInput(""); setFeedback(null); }}>Исправить ошибку</button></div>
    <div className="formula-recall-card"><span className="formula-recall-kicker">{card.title}</span><h3>{mode === "fix" ? "Исправь ошибку в записи формулы" : card.prompt}</h3>{mode === "fix" && <div className="formula-broken">{broken}</div>}{mode !== "choice" ? <><input className="formula-recall-input" value={input} onChange={event => { setInput(event.target.value); setFeedback(null); }} onKeyDown={event => { if (event.key === "Enter") { if (mode === "fix") fixFormula(); else check(); } }} placeholder="Например: F = ma" aria-label="Ответ формулой" /><div className="formula-recall-actions"><button className="primary" onClick={mode === "fix" ? fixFormula : check} disabled={!input.trim()}>Проверить</button><button className="hint-button" onClick={() => setFeedback(card.hint)}>Подсказка</button><button className="task-action-button" onClick={next}>Следующая →</button></div></> : <div className="formula-choice-grid">{choices.map(choice => <button key={choice} onClick={() => choose(choice)}>{choice}</button>)}<button className="task-action-button" onClick={next}>Следующая →</button></div>}{feedback && <div className={`answer-feedback ${state.solved ? "success" : "error"}`}>{feedback}{state.revealAnswer && <strong> Ответ: {card.formula}</strong>}{state.showHint && !state.revealAnswer && <small> Подсказка открыта после двух ошибок.</small>}</div>}</div>
  </div>;
}
