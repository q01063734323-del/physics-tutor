"use client";

import { useMemo, useState } from "react";
import { validateFormula } from "@/lib/formulaValidator";
import { applyFormulaAnswer, createFormulaAttempt, type FormulaAttempt } from "@/lib/formulaTrainer";

type Card = { id: string; topic: string; title: string; prompt: string; formula: string; hint: string };

const cards: Card[] = [
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
  const [index, setIndex] = useState(0);
  const [input, setInput] = useState("");
  const [state, setState] = useState<FormulaAttempt>(createFormulaAttempt());
  const [feedback, setFeedback] = useState<string | null>(null);
  const card = useMemo(() => cards[index], [index]);

  function check() {
    const result = validateFormula(input, card.id);
    setState(previous => applyFormulaAnswer(previous, result.isValid));
    setFeedback(result.isValid ? "Верно! Формула распознана." : "Пока не совпало. Попробуй ещё раз или воспользуйся подсказкой.");
  }

  function next() {
    setIndex(value => (value + 1) % cards.length);
    setInput("");
    setState(createFormulaAttempt());
    setFeedback(null);
  }

  return <div className="formula-recall">
    <div className="formula-recall-head"><div><div className="eyebrow">Активное вспоминание</div><h4>Тренажёр формул</h4><p className="muted">Вспомни формулу по смыслу и запиши её с клавиатуры. Карточка {index + 1} из {cards.length}.</p></div><span className="tag ready">{card.topic}</span></div>
    <div className="formula-recall-card"><span className="formula-recall-kicker">{card.title}</span><h3>{card.prompt}</h3><input className="formula-recall-input" value={input} onChange={event => { setInput(event.target.value); setFeedback(null); }} onKeyDown={event => { if (event.key === "Enter") check(); }} placeholder="Например: F = ma" aria-label="Ответ формулой" /><div className="formula-recall-actions"><button className="primary" onClick={check} disabled={!input.trim()}>Проверить</button><button className="hint-button" onClick={() => setFeedback(card.hint)}>Подсказка</button><button className="task-action-button" onClick={next}>Следующая →</button></div>{feedback && <div className={`answer-feedback ${state.solved ? "success" : "error"}`}>{feedback}{state.revealAnswer && <strong> Ответ: {card.formula}</strong>}{state.showHint && !state.revealAnswer && <small> Подсказка открыта после двух ошибок.</small>}</div>}</div>
  </div>;
}
