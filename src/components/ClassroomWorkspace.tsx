"use client";

import { useRef, useState, type PointerEvent } from "react";
import Link from "next/link";
import { PhysicsIcon, PhysicsMark } from "./PhysicsMark";

type Stroke = { color: string; points: string[] };
const colors = [{ value: "#163b31", name: "Графитовый" }, { value: "#187658", name: "Зелёный" }, { value: "#ae482c", name: "Терракотовый" }];

export function ClassroomWorkspace() {
  const board = useRef<SVGSVGElement>(null);
  const controls = useRef<HTMLElement>(null);
  const drawing = useRef<Stroke | null>(null);
  const activePointer = useRef<number | null>(null);
  const [color, setColor] = useState(colors[0].value);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [draft, setDraft] = useState<Stroke | null>(null);
  const [notes, setNotes] = useState("");
  const [confirmExit, setConfirmExit] = useState(false);

  function requestExit() {
    setConfirmExit(true);
    controls.current?.scrollIntoView({ block: "nearest" });
  }

  function point(event: PointerEvent<SVGSVGElement>) {
    const matrix = board.current?.getScreenCTM();
    if (!matrix) return;
    const local = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
    return `${local.x.toFixed(1)},${local.y.toFixed(1)}`;
  }

  function start(event: PointerEvent<SVGSVGElement>) {
    if (event.button !== 0 || activePointer.current !== null) return;
    const startPoint = point(event);
    if (!startPoint) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    activePointer.current = event.pointerId;
    drawing.current = { color, points: [startPoint, startPoint] };
    setDraft(drawing.current);
  }

  function move(event: PointerEvent<SVGSVGElement>) {
    if (!drawing.current || activePointer.current !== event.pointerId) return;
    const next = point(event);
    if (!next) return;
    drawing.current = { ...drawing.current, points: [...drawing.current.points, next] };
    setDraft(drawing.current);
  }

  function end(event: PointerEvent<SVGSVGElement>) {
    if (activePointer.current !== event.pointerId) return;
    const stroke = drawing.current;
    if (stroke) setStrokes(previous => [...previous, stroke]);
    activePointer.current = null;
    drawing.current = null;
    setDraft(null);
  }

  return <main className="pt-classroom">
    <header className="pt-room-header"><PhysicsMark /><div className="pt-room-title"><strong>Виртуальный класс</strong><span>Самостоятельная работа</span></div><button type="button" className="pt-room-return" onClick={requestExit}>В кабинет <PhysicsIcon name="arrow" size={17} /></button></header>
    <div className="pt-room-grid">
      <section className="pt-board-panel" aria-labelledby="pt-board-title">
        <div className="pt-board-header"><div><p className="pt-kicker">РАБОЧАЯ ОБЛАСТЬ</p><h1 id="pt-board-title">Доска для решения</h1></div><span>Локально</span></div>
        <div className="pt-board-tools" aria-label="Инструменты доски">
          <span><PhysicsIcon name="pen" size={17} /> Перо</span>
          {colors.map(item => <button key={item.value} type="button" className="pt-ink" style={{ backgroundColor: item.value }} aria-label={item.name} aria-pressed={color === item.value} onClick={() => setColor(item.value)} />)}
          <button type="button" disabled={!strokes.length} onClick={() => setStrokes(items => items.slice(0, -1))}>Отменить штрих</button>
        </div>
        <div className="pt-drawing-surface">
          {!strokes.length && !draft && <p>Начните рисовать мышью или касанием.</p>}
          <svg ref={board} viewBox="0 0 900 520" preserveAspectRatio="none" aria-label="Область для рисования" role="img" onPointerDown={start} onPointerMove={move} onPointerUp={end} onPointerCancel={end} onLostPointerCapture={end}>
            {[...strokes, ...(draft ? [draft] : [])].map((stroke, i) => <polyline key={i} points={stroke.points.join(" ")} fill="none" stroke={stroke.color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />)}
          </svg>
        </div>
      </section>
      <aside className="pt-room-side">
        <div className="pt-room-side-head"><h2>Участники</h2><span>Без звонка</span></div>
        {["Преподаватель", "Ученик"].map(label => <div className="pt-video-slot" key={label}><PhysicsIcon name="video" size={24} /><div><b>{label}</b><span>Видеосвязь не подключена</span></div></div>)}
        <label className="pt-room-notes">Заметки<textarea value={notes} onChange={event => setNotes(event.target.value)} placeholder="Условие, формулы или ход решения…" /></label>
      </aside>
    </div>
    <footer className="pt-room-controls" ref={controls}>
      <div className="pt-media-actions">{([["mic", "Микрофон"], ["video", "Камера"], ["screen", "Показ экрана"]] as const).map(([icon, label]) => <button key={icon} type="button" disabled><PhysicsIcon name={icon} size={19} />{label}</button>)}</div>
      <p>Звонок недоступен. Рисунок и заметки остаются только на этой странице.</p>
      {confirmExit ? <div className="pt-exit-actions"><button type="button" onClick={() => setConfirmExit(false)}>Остаться</button><Link className="pt-exit" href="/">Выйти</Link></div> : <button type="button" className="pt-exit" onClick={requestExit}>Завершить работу</button>}
    </footer>
    {confirmExit && <p className="pt-exit-warning" role="status">Если выйти, рисунок и заметки не сохранятся.</p>}
  </main>;
}
