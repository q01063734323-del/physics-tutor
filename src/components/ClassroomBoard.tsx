"use client";

import { useRef, useState, type PointerEvent } from "react";
import { classroomColors, classroomPointLimit, type ClassroomStroke } from "@/lib/classroom";
import { PhysicsIcon } from "./PhysicsMark";

type BoardProps = {
  label: string;
  strokes: ClassroomStroke[];
  accountId: string;
  canDraw: boolean;
  canEraseAll?: boolean;
  onStroke: (stroke: Omit<ClassroomStroke, "author">) => void;
  onErase: (strokeId: string) => void;
  onUndo: () => void;
};

export function ClassroomBoard({ label, strokes, accountId, canDraw, canEraseAll, onStroke, onErase, onUndo }: BoardProps) {
  const board = useRef<SVGSVGElement>(null);
  const drawing = useRef<Omit<ClassroomStroke, "author"> | null>(null);
  const activePointer = useRef<number | null>(null);
  const [color, setColor] = useState<string>(classroomColors[0].value);
  const [erasing, setErasing] = useState(false);
  const [draft, setDraft] = useState<Omit<ClassroomStroke, "author"> | null>(null);

  function point(event: PointerEvent<SVGSVGElement>) {
    const matrix = board.current?.getScreenCTM();
    if (!matrix) return;
    const local = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
    return `${Math.max(0, Math.min(900, local.x)).toFixed(1)},${Math.max(0, Math.min(520, local.y)).toFixed(1)}`;
  }

  function start(event: PointerEvent<SVGSVGElement>) {
    if (!canDraw || event.button !== 0 || activePointer.current !== null) return;
    if (erasing) {
      const target = event.target instanceof SVGElement ? event.target.dataset.strokeId : undefined;
      if (target && strokes.some(stroke => stroke.id === target && (canEraseAll || stroke.author === accountId))) onErase(target);
      return;
    }
    const startPoint = point(event);
    if (!startPoint) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    activePointer.current = event.pointerId;
    drawing.current = { id: crypto.randomUUID(), color, points: [startPoint, startPoint] };
    setDraft(drawing.current);
  }

  function move(event: PointerEvent<SVGSVGElement>) {
    if (!canDraw || !drawing.current || activePointer.current !== event.pointerId) return;
    const next = point(event);
    if (!next || next === drawing.current.points.at(-1)) return;
    const points = drawing.current.points.length >= classroomPointLimit
      ? drawing.current.points.filter((_, index) => index % 2 === 0)
      : drawing.current.points;
    drawing.current = { ...drawing.current, points: [...points, next] };
    setDraft(drawing.current);
  }

  function end(event: PointerEvent<SVGSVGElement>) {
    if (activePointer.current !== event.pointerId) return;
    const stroke = drawing.current;
    activePointer.current = null;
    drawing.current = null;
    setDraft(null);
    if (stroke && canDraw) onStroke(stroke);
  }

  return (
    <section className="pt-board-panel" aria-labelledby="pt-board-title">
      <div className="pt-board-header">
        <div><p className="pt-kicker">РАБОЧАЯ ОБЛАСТЬ</p><h1 id="pt-board-title">Доска для решения</h1></div>
        <span>{label}</span>
      </div>
      <div className="pt-board-tools" role="group" aria-label="Инструменты доски">
        <button type="button" aria-pressed={!erasing} disabled={!canDraw} onClick={() => setErasing(false)}><PhysicsIcon name="pen" size={17} /> Перо</button>
        {classroomColors.map(item => (
          <button key={item.value} type="button" className="pt-ink" style={{ backgroundColor: item.value }}
            aria-label={item.name} disabled={!canDraw} aria-pressed={!erasing && color === item.value}
            onClick={() => { setColor(item.value); setErasing(false); }} />
        ))}
        <button type="button" disabled={!canDraw} aria-pressed={erasing} onClick={() => setErasing(!erasing)}>Ластик</button>
        <button type="button" disabled={!canDraw || !strokes.some(stroke => stroke.author === accountId)} onClick={onUndo}>Отменить штрих</button>
      </div>
      <div className={`pt-drawing-surface${erasing ? " pt-erasing" : ""}`}>
        {!strokes.length && !draft && <p>{canDraw ? "Начните рисовать мышью или касанием." : "Рисование сейчас недоступно."}</p>}
        <svg ref={board} viewBox="0 0 900 520" preserveAspectRatio="none" aria-label="Область для рисования"
          role="img" onPointerDown={start} onPointerMove={move} onPointerUp={end} onPointerCancel={end} onLostPointerCapture={end}>
          {[...strokes, ...(draft ? [draft] : [])].map(stroke => (
            <polyline key={stroke.id} data-stroke-id={stroke.id} points={stroke.points.join(" ")}
              fill="none" stroke={stroke.color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
          ))}
        </svg>
      </div>
    </section>
  );
}
