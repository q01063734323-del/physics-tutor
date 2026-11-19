"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { ClassroomBoard } from "./ClassroomBoard";
import { StudioPrejoin } from "./StudioPrejoin";
import { StudioDialog } from "./StudioDialog";
import { PhysicsStudio } from "./PhysicsStudio";
import { useClassroomMedia } from "@/lib/use-classroom-media";
import { emptyClassroomBoard, type ClassroomBoardState, type ClassroomSession, type ClassroomStroke } from "@/lib/classroom";
import type { MediaPreferences } from "@/lib/studio/model";
import s from "./PhysicsStudio.module.css";

type GuestSession = ClassroomSession & { access: string; guestAccess?: string; expiresAt: number };
async function guestRequest<T>(body: Record<string, unknown>, access?: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch("/api/classroom/demo", { method: "POST", cache: "no-store", signal,
    headers: { "Content-Type": "application/json", ...(access ? { Authorization: `Bearer ${access}` } : {}) }, body: JSON.stringify(body) });
  const data = await response.json(); if (!response.ok) throw new Error(data.error || "Не удалось выполнить действие."); return data as T;
}
function DemoRoom({ initialSession, preferences, onLeave }: { initialSession: GuestSession; preferences: MediaPreferences; onLeave: () => void }) {
  const [session, setSession] = useState(initialSession);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [board, setBoard] = useState<ClassroomBoardState>(emptyClassroomBoard);
  const [strokes, setStrokes] = useState<ClassroomStroke[]>([]);
  const [ready, setReady] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [confirmExit, setConfirmExit] = useState(false);
  const [invite, setInvite] = useState("");
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const media = useClassroomMedia(session, setNotice, setError, preferences);
  const teacher = session.role === "teacher";
  const request = useCallback(<T,>(body: Record<string, unknown>, signal?: AbortSignal) => guestRequest<T>({ ...body, roomId: session.roomId }, session.access, signal), [session.access, session.roomId]);
  useEffect(() => {
    const controller = new AbortController(); let timeout: ReturnType<typeof setTimeout>;
    async function sync() {
      try {
        const data = await request<{ board: ClassroomBoardState }>({ action: "state" }, controller.signal);
        if (controller.signal.aborted) return; setBoard(data.board); setReady(true);
        setStrokes(previous => previous.filter(stroke => !data.board.strokes.some(saved => saved.id === stroke.id)));
      } catch (problem) {
        if (controller.signal.aborted) return;
        const message = problem instanceof Error ? problem.message : "Нет связи с доской."; setError(message);
        if (message.includes("Урок завершён")) { onLeave(); return; }
      }
      if (!controller.signal.aborted) timeout = setTimeout(() => void sync(), 1500);
    }
    void sync(); return () => { controller.abort(); clearTimeout(timeout); };
  }, [onLeave, request]);
  function enqueue(body: Record<string, unknown>) { const result = queue.current.catch(() => undefined).then(() => request(body)); queue.current = result; return result; }
  async function run(action: () => Promise<unknown>) {
    if (pending) return; setPending(true); setError("");
    try { await action(); } catch (problem) { setError(problem instanceof Error ? problem.message : "Не удалось выполнить действие."); } finally { setPending(false); }
  }
  function submitStroke(stroke: Omit<ClassroomStroke, "author">) {
    setStrokes(previous => [...previous, { ...stroke, author: session.role }]);
    void enqueue({ action: "stroke", stroke }).catch(problem => { setStrokes(previous => previous.filter(item => item.id !== stroke.id)); setError(problem.message); });
  }
  async function saveNote() { if (note === null) return; await enqueue({ action: "notes", text: note }); setNote(null); }
  async function shareInvite() {
    const url = new URL("/classroom", window.location.origin); url.searchParams.set("guest", session.roomId);
    const access = session.guestAccess || sessionStorage.getItem(`physics-guest-invite-${session.roomId}`);
    if (!access) { setError("Ссылка ученика доступна в браузере, где создан урок."); return; }
    url.hash = new URLSearchParams({ access }).toString(); setInvite(url.href);
    try { await navigator.clipboard.writeText(url.href); setNotice("Личная ссылка скопирована. Передай её только ученику."); } catch { setNotice("Скопируй приглашение из поля выше."); }
  }
  return <><PhysicsStudio media={media} role={session.role} accountId={`guest-${session.role}`} error={error} notice={notice} invitation={invite} onInvite={shareInvite} onLeave={() => setConfirmExit(true)} onReconnect={async () => { const next = await request<ClassroomSession>({ action: "join" }); setSession({ ...session, ...next }); }}
    board={<ClassroomBoard label={ready ? "Общая доска" : "Загружаем…"} strokes={[...board.strokes, ...strokes.filter(stroke => !board.strokes.some(saved => saved.id === stroke.id))]} accountId={session.role} canDraw={ready} canEraseAll={teacher} onStroke={submitStroke} onErase={strokeId => void run(() => enqueue({ action: "erase", strokeId }))} onUndo={() => void run(() => enqueue({ action: "undo" }))}/>}
    resources={<><label className="pt-room-notes">Ваши заметки<textarea maxLength={6000} value={note ?? board.notes[session.role] ?? ""} disabled={!ready} onChange={event => setNote(event.target.value)} onBlur={() => void run(saveNote)} placeholder="Условие, формулы, решение…"/></label><div className="pt-peer-note"><b>Заметки {teacher ? "ученика" : "преподавателя"}</b><p>{board.notes[teacher ? "student" : "teacher"] || "Пока пусто."}</p></div><p className={s.muted}>Гостевой урок защищён личной ссылкой и действует четыре часа. Для постоянных уроков используй аккаунт.</p></>}/>
    {confirmExit && <StudioDialog title="Выйти из студии?" id="studio-guest-exit" onClose={() => setConfirmExit(false)}><p>Можно вернуться по той же личной ссылке, пока урок открыт.</p>{error && <p role="alert" className={s.error}>{error}</p>}<button type="button" onClick={() => setConfirmExit(false)}>Остаться</button><button type="button" disabled={pending} onClick={() => void run(async () => { await saveNote(); onLeave(); })}>Выйти из звонка</button>{teacher && <button type="button" disabled={pending} onClick={() => void run(async () => { await saveNote(); await request({ action: "end" }); onLeave(); })}>Завершить урок для всех</button>}</StudioDialog>}
  </>;
}
export function DemoClassroom() {
  const [session, setSession] = useState<GuestSession | null>(null);
  const [preferences, setPreferences] = useState<MediaPreferences | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [left, setLeft] = useState(false);
  const leave = useCallback(() => { setSession(null); setPreferences(null); setLeft(true); }, []);
  async function enter() {
    setBusy(true); setError("");
    try {
      const roomId = new URLSearchParams(window.location.search).get("guest"); const access = new URLSearchParams(window.location.hash.slice(1)).get("access");
      if (roomId && !access) throw new Error("Открой полную ссылку приглашения от преподавателя.");
      const next = await guestRequest<GuestSession>(roomId ? { action: "join", roomId } : { action: "create" }, access ?? undefined);
      if (next.guestAccess) sessionStorage.setItem(`physics-guest-invite-${next.roomId}`, next.guestAccess);
      const nextSession = { ...next, access: next.access || access || "" }; setPreferences(null); setSession(nextSession);
      const url = new URL("/classroom", window.location.origin); url.searchParams.set("guest", next.roomId); url.hash = new URLSearchParams({ access: nextSession.access }).toString(); window.history.replaceState(null, "", url); setLeft(false);
    } catch (problem) { setError(problem instanceof Error ? problem.message : "Не удалось открыть урок."); } finally { setBusy(false); }
  }
  if (session) return preferences ? <DemoRoom initialSession={session} preferences={preferences} onLeave={leave}/> : <StudioPrejoin name={session.role === "teacher" ? "Преподаватель" : "Ученик"} lesson="Индивидуальный гостевой урок · личная ссылка" onJoin={setPreferences} onCancel={leave}/>;
  return <main className={s.prejoin}><header className={s.brand}><span className={s.brandMark}>φ</span><div><b>PHYSICS STUDIO</b><small>MIDNIGHT LABORATORY</small></div></header><section className={s.lobby}><p className={s.eyebrow}>ИНДИВИДУАЛЬНО. ВМЕСТЕ.</p><h1>{left ? "До следующего открытия." : "Физика на большом экране."}</h1><p>Видеосвязь, общая доска и PowerPoint в центре внимания. Включение устройств — только после подготовки.</p>{error && <p role="alert" className={s.error}>{error}</p>}<div className={s.entryActions}><button type="button" className={s.primary} disabled={busy} onClick={() => void enter()}>{busy ? "Открываем…" : "Открыть онлайн-урок"}</button><Link href="/">В кабинет</Link></div><p className={s.muted}>Личное приглашение действует четыре часа. Не передавай ссылку посторонним. Запись звонка не ведётся.</p></section></main>;
}
