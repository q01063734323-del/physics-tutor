"use client";

import { useRef, useState, type MouseEvent, type ReactNode } from "react";
import Link from "next/link";
import type { ClassroomStroke } from "@/lib/classroom";
import { ClassroomBoard } from "./ClassroomBoard";
import { PhysicsIcon, PhysicsMark } from "./PhysicsMark";

export function ClassroomWorkspace({ lobby }: { lobby?: ReactNode }) {
  const exitTrigger = useRef<HTMLButtonElement>(null);
  const endSession = useRef<HTMLButtonElement>(null);
  const [strokes, setStrokes] = useState<ClassroomStroke[]>([]);
  const [notes, setNotes] = useState("");
  const [confirmExit, setConfirmExit] = useState(false);

  function requestExit(event: MouseEvent<HTMLButtonElement>) {
    exitTrigger.current = event.currentTarget;
    setConfirmExit(true);
  }

  function cancelExit() {
    setConfirmExit(false);
    requestAnimationFrame(() => {
      const trigger = exitTrigger.current;
      (trigger?.isConnected ? trigger : endSession.current)?.focus();
    });
  }

  return <main className="pt-classroom">
    <header className="pt-room-header"><PhysicsMark linked={false} /><div className="pt-room-title"><strong>Виртуальный класс</strong><span>Самостоятельная работа</span></div><button type="button" className="pt-room-return" onClick={requestExit}>В кабинет <PhysicsIcon name="arrow" size={17} /></button></header>
    {lobby}
    <div className="pt-room-grid">
      <ClassroomBoard label="Локально" strokes={strokes} accountId="local" canDraw
        onStroke={stroke => setStrokes(items => [...items, { ...stroke, author: "local" }])}
        onErase={id => setStrokes(items => items.filter(stroke => stroke.id !== id))}
        onUndo={() => setStrokes(items => items.slice(0, -1))} />
      <aside className="pt-room-side">
        <div className="pt-room-side-head"><h2>Участники</h2><span>Без звонка</span></div>
        {["Преподаватель", "Ученик"].map(label => <div className="pt-video-slot" key={label}><PhysicsIcon name="video" size={24} /><div><b>{label}</b><span>Откройте онлайн-урок для подключения</span></div></div>)}
        <label className="pt-room-notes">Заметки<textarea value={notes} onChange={event => setNotes(event.target.value)} placeholder="Условие, формулы или ход решения…" /></label>
      </aside>
    </div>
    <footer className="pt-room-controls">
      <div className="pt-media-actions">{([["mic", "Микрофон"], ["video", "Камера"], ["screen", "Показ экрана"]] as const).map(([icon, label]) => <button key={icon} type="button" disabled><PhysicsIcon name={icon} size={19} />{label}</button>)}</div>
      <p>Звонок недоступен. Рисунок и заметки остаются только на этой странице.</p>
      {confirmExit ? (
        <div className="pt-exit-actions" role="group" aria-label="Подтверждение выхода" onKeyDown={event => { if (event.key === "Escape") cancelExit(); }}>
          <button type="button" ref={button => { button?.focus(); }} onClick={cancelExit}>Остаться</button>
          <Link className="pt-exit" href="/" aria-describedby="pt-exit-warning">Выйти</Link>
        </div>
      ) : <button type="button" className="pt-exit" ref={endSession} onClick={requestExit}>Завершить работу</button>}
    </footer>
    {confirmExit && <p className="pt-exit-warning" id="pt-exit-warning" role="status">Если выйти, рисунок и заметки не сохранятся.</p>}
  </main>;
}
