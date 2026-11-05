"use client";

import { useMemo, useState } from "react";

type Entry = { category: string; name: string; formula: string; symbols: string; units: string; use: string; example: string };
const entries: Entry[] = [
  { category: "Механика", name: "Второй закон Ньютона", formula: "F = ma", symbols: "F — сила, m — масса, a — ускорение", units: "Н, кг, м/с²", use: "Расчёт движения тела под действием силы", example: "m = 2 кг, a = 3 м/с² → F = 6 Н" },
  { category: "Механика", name: "Кинетическая энергия", formula: "Eк = mv²/2", symbols: "m — масса, v — скорость", units: "Дж, кг, м/с", use: "Энергия движущегося тела", example: "m = 4 кг, v = 2 м/с → Eк = 8 Дж" },
  { category: "Молекулярная физика", name: "Плотность", formula: "ρ = m/V", symbols: "m — масса, V — объём", units: "кг/м³, кг, м³", use: "Сравнение веществ и расчёт массы", example: "m = 2 кг, V = 0,5 м³ → ρ = 4 кг/м³" },
  { category: "Термодинамика", name: "Количество теплоты", formula: "Q = cmΔt", symbols: "c — удельная теплоёмкость, m — масса, Δt — изменение температуры", units: "Дж, Дж/(кг·°C), кг, °C", use: "Нагревание и охлаждение тел", example: "c = 4200, m = 2 кг, Δt = 10 °C → Q = 84000 Дж" },
  { category: "Электродинамика", name: "Закон Ома", formula: "I = U/R", symbols: "I — ток, U — напряжение, R — сопротивление", units: "А, В, Ом", use: "Расчёт параметров участка цепи", example: "U = 12 В, R = 6 Ом → I = 2 А" },
  { category: "Оптика", name: "Тонкая линза", formula: "1/F = 1/d + 1/f", symbols: "F — фокус, d — расстояние до предмета, f — до изображения", units: "м", use: "Построение изображений в линзе", example: "Подставь расстояния в метрах и найди неизвестное" },
  { category: "Колебания и волны", name: "Связь периода и частоты", formula: "ν = 1/T", symbols: "ν — частота, T — период", units: "Гц, с", use: "Описание повторяющихся процессов", example: "T = 0,5 с → ν = 2 Гц" },
];

export default function FormulaReference() {
  const [category, setCategory] = useState("Все");
  const [open, setOpen] = useState<string | null>(null);
  const categories = ["Все", ...Array.from(new Set(entries.map(entry => entry.category)))];
  const visible = useMemo(() => category === "Все" ? entries : entries.filter(entry => entry.category === category), [category]);
  return <div className="reference-panel"><div className="section-head"><div><div className="eyebrow">Справочник</div><h3>Формулы по разделам физики</h3></div><span className="results-count">{visible.length} формул</span></div><div className="reference-tabs">{categories.map(item => <button key={item} className={category === item ? "selected" : ""} onClick={() => { setCategory(item); setOpen(null); }}>{item}</button>)}</div><div className="reference-grid">{visible.map(entry => <article className="reference-card" key={entry.name}><span className="tag ready">{entry.category}</span><h4>{entry.name}</h4><div className="reference-formula">{entry.formula}</div><p>{entry.symbols}</p>{open === entry.name && <div className="reference-details"><b>Единицы:</b> {entry.units}<br /><b>Применение:</b> {entry.use}<br /><b>Пример:</b> {entry.example}</div>}<div className="reference-actions"><button className="task-action-button" onClick={() => setOpen(open === entry.name ? null : entry.name)}>{open === entry.name ? "Скрыть" : "Подробнее"}</button><button className="formula-copy" onClick={() => navigator.clipboard?.writeText(entry.formula)}>Копировать</button></div></article>)}</div></div>;
}
