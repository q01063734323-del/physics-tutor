"use client";

import { useMemo, useState } from "react";

type Experiment = "newton" | "motion" | "ohm";

function Graph({ points, color = "#526df5" }: { points: Array<[number, number]>; color?: string }) {
  const path = points.map(([x, y], i) => `${i ? "L" : "M"}${20 + x * 2.5},${125 - y * 1.05}`).join(" ");
  return <svg className="lab-graph" viewBox="0 0 300 140" role="img" aria-label="График эксперимента"><path d="M20 125H285M20 125V12" className="graph-axis" /><path d={path} fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" /></svg>;
}

export default function PhysicalLab() {
  const [experiment, setExperiment] = useState<Experiment>("newton");
  const [mass, setMass] = useState(2);
  const [force, setForce] = useState(10);
  const [acceleration, setAcceleration] = useState(2);
  const [time, setTime] = useState(5);
  const [voltage, setVoltage] = useState(12);
  const [resistance, setResistance] = useState(6);
  const result = useMemo(() => {
    if (experiment === "newton") return { title: "Второй закон Ньютона", text: "Ускорение прямо пропорционально силе и обратно пропорционально массе.", values: [`F = ${force} Н`, `m = ${mass} кг`, `a = ${(force / mass).toFixed(2)} м/с²`], points: Array.from({ length: 9 }, (_, i) => [i, (force / mass) * i] as [number, number]) };
    if (experiment === "motion") return { title: "Равномерное и равноускоренное движение", text: "При постоянном ускорении скорость растёт линейно, а путь — квадратично.", values: [`a = ${acceleration} м/с²`, `t = ${time} с`, `v = ${(acceleration * time).toFixed(2)} м/с`, `s = ${(acceleration * time * time / 2).toFixed(2)} м`], points: Array.from({ length: 9 }, (_, i) => [i, acceleration * i] as [number, number]) };
    return { title: "Закон Ома", text: "Сила тока равна отношению напряжения к сопротивлению.", values: [`U = ${voltage} В`, `R = ${resistance} Ом`, `I = ${(voltage / resistance).toFixed(2)} А`], points: Array.from({ length: 9 }, (_, i) => [i, (voltage / resistance) * i] as [number, number]) };
  }, [experiment, mass, force, acceleration, time, voltage, resistance]);

  return <section className="lab-panel"><div className="section-head"><div><div className="eyebrow">Практика и эксперименты</div><h3>Физическая лаборатория</h3><p className="muted">Меняй параметры и наблюдай, как физический закон меняет результат.</p></div><span className="tag ready">Расчёт в реальном времени</span></div><div className="lab-tabs">{([ ["newton", "Второй закон Ньютона"], ["motion", "Движение"], ["ohm", "Закон Ома"]] as const).map(([id, label]) => <button key={id} className={experiment === id ? "selected" : ""} onClick={() => setExperiment(id)}>{label}</button>)}</div><div className="lab-grid"><div className="lab-controls">{experiment === "newton" && <><label>Масса: <b>{mass} кг</b><input type="range" min="1" max="10" value={mass} onChange={e => setMass(Number(e.target.value))} /></label><label>Сила: <b>{force} Н</b><input type="range" min="1" max="30" value={force} onChange={e => setForce(Number(e.target.value))} /></label></>}{experiment === "motion" && <><label>Ускорение: <b>{acceleration} м/с²</b><input type="range" min="1" max="10" value={acceleration} onChange={e => setAcceleration(Number(e.target.value))} /></label><label>Время: <b>{time} с</b><input type="range" min="1" max="10" value={time} onChange={e => setTime(Number(e.target.value))} /></label></>}{experiment === "ohm" && <><label>Напряжение: <b>{voltage} В</b><input type="range" min="1" max="24" value={voltage} onChange={e => setVoltage(Number(e.target.value))} /></label><label>Сопротивление: <b>{resistance} Ом</b><input type="range" min="1" max="20" value={resistance} onChange={e => setResistance(Number(e.target.value))} /></label></>}<div className="lab-values">{result.values.map(value => <span key={value}>{value}</span>)}</div></div><div className="lab-visual"><div className="lab-orbit"><i /><span>●</span></div><Graph points={result.points} color={experiment === "ohm" ? "#55bfae" : "#526df5"} /><p><b>{result.title}.</b> {result.text}</p></div></div></section>;
}
