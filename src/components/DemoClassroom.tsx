"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { ConnectionState, type Track } from "livekit-client";
import { ClassroomBoard } from "./ClassroomBoard";
import { PhysicsIcon, PhysicsMark } from "./PhysicsMark";
import { classroomMediaError, useClassroomMedia } from "@/lib/use-classroom-media";
import { emptyClassroomBoard, type ClassroomBoardState, type ClassroomSession, type ClassroomStroke } from "@/lib/classroom";

type GuestSession = ClassroomSession & { access: string; guestAccess?: string; expiresAt: number };

async function guestRequest<T>(body: Record<string, unknown>, access?: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch("/api/classroom/demo", {
    method: "POST", cache: "no-store", signal,
    headers: { "Content-Type": "application/json", ...(access ? { Authorization: `Bearer ${access}` } : {}) },
    body: JSON.stringify(body),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Не удалось выполнить действие.");
  return data as T;
}

function TrackView({ track, audio = false, label, muted = false }: { track: Track; audio?: boolean; label: string; muted?: boolean }) {
  const element = useRef<HTMLMediaElement | null>(null);
  useEffect(() => {
    const node = element.current;
    if (!node) return;
    track.attach(node);
    return () => { track.detach(node); };
  }, [track]);
  return audio
    ? <audio ref={node => { element.current = node; }} autoPlay aria-label={label} />
    : <video ref={node => { element.current = node; }} autoPlay playsInline muted={muted} aria-label={label} />;
}

const stateLabels: Record<ConnectionState, string> = {
  [ConnectionState.Connected]: "На связи",
  [ConnectionState.Connecting]: "Подключаемся…",
  [ConnectionState.Disconnected]: "Связь прервана",
  [ConnectionState.Reconnecting]: "Восстанавливаем связь…",
  [ConnectionState.SignalReconnecting]: "Восстанавливаем связь…",
};

function DemoRoom({ initialSession, onLeave }: { initialSession: GuestSession; onLeave: () => void }) {
  const [session, setSession] = useState(initialSession);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [board, setBoard] = useState<ClassroomBoardState>(emptyClassroomBoard);
  const [pendingStrokes, setPendingStrokes] = useState<ClassroomStroke[]>([]);
  const [ready, setReady] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [showVideo, setShowVideo] = useState(false);
  const [confirmExit, setConfirmExit] = useState(false);
  const [invite, setInvite] = useState("");
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const media = useClassroomMedia(session, setNotice, setError, false);
  const local = media.participants.find(participant => participant.local);
  const teacher = session.role === "teacher";
  const connected = media.state === ConnectionState.Connected;
  const screen = media.participants.find(participant => participant.screen && !participant.local)
    ?? media.participants.find(participant => participant.screen);

  const request = useCallback(<T,>(body: Record<string, unknown>, signal?: AbortSignal) =>
    guestRequest<T>({ ...body, roomId: session.roomId }, session.access, signal), [session.access, session.roomId]);

  useEffect(() => {
    const controller = new AbortController();
    let timeout: ReturnType<typeof setTimeout>;
    async function sync() {
      try {
        const data = await request<{ board: ClassroomBoardState }>({ action: "state" }, controller.signal);
        if (controller.signal.aborted) return;
        setBoard(data.board);
        setReady(true);
        setPendingStrokes(previous => previous.filter(stroke => !data.board.strokes.some(saved => saved.id === stroke.id)));
      } catch (problem) {
        if (controller.signal.aborted) return;
        const message = problem instanceof Error ? problem.message : "Нет связи с доской.";
        setError(message);
        if (message.includes("Урок завершён")) { onLeave(); return; }
      }
      if (!controller.signal.aborted) timeout = setTimeout(() => void sync(), 1200);
    }
    void sync();
    return () => { controller.abort(); clearTimeout(timeout); };
  }, [onLeave, request]);

  function enqueue(body: Record<string, unknown>) {
    const result = queue.current.catch(() => undefined).then(() => request(body));
    queue.current = result;
    return result;
  }

  function submitStroke(stroke: Omit<ClassroomStroke, "author">) {
    setPendingStrokes(previous => [...previous, { ...stroke, author: session.role }]);
    void enqueue({ action: "stroke", stroke }).catch(problem => {
      setPendingStrokes(previous => previous.filter(item => item.id !== stroke.id));
      setError(problem.message);
    });
  }

  async function run(action: () => Promise<unknown>) {
    if (pending) return;
    setPending(true);
    setError("");
    try { await action(); }
    catch (problem) { setError(classroomMediaError(problem, problem instanceof Error ? problem.message : "Не удалось выполнить действие.")); }
    finally { setPending(false); }
  }

  async function shareInvite() {
    const url = new URL("/classroom", window.location.origin);
    url.searchParams.set("guest", session.roomId);
    const guestAccess = session.guestAccess || sessionStorage.getItem(`physics-guest-invite-${session.roomId}`);
    if (!guestAccess) { setError("Ссылка ученика доступна в браузере, где создан урок."); return; }
    url.hash = new URLSearchParams({ access: guestAccess }).toString();
    setInvite(url.href);
    try { await navigator.clipboard.writeText(url.href); setNotice("Приглашение скопировано. Отправьте его ученику."); }
    catch { setNotice("Скопируйте приглашение из поля ниже."); }
  }

  const strokes = [...board.strokes, ...pendingStrokes.filter(stroke => !board.strokes.some(saved => saved.id === stroke.id))];

  return <main className="pt-classroom pt-live-room">
    <header className="pt-room-header">
      <PhysicsMark linked={false} />
      <div className="pt-room-title"><strong>Онлайн-урок</strong><span role="status">{stateLabels[media.state]}</span></div>
      <button type="button" className="pt-room-return" onClick={() => setConfirmExit(true)}>Выйти <PhysicsIcon name="arrow" size={17} /></button>
    </header>
    <div className="pt-live-toolbar">
      <div role="group" aria-label="Рабочая область">
        <button type="button" aria-pressed={!showVideo} onClick={() => setShowVideo(false)}>Доска</button>
        <button type="button" aria-pressed={showVideo} onClick={() => setShowVideo(true)}>Видео</button>
      </div>
      {teacher && <button type="button" onClick={() => void shareInvite()}>Пригласить ученика</button>}
    </div>
    {invite && <label className="pt-live-invite">Личная ссылка ученика<input type="url" value={invite} readOnly onFocus={event => event.target.select()} /></label>}
    {error && <p role="alert" className="pt-lesson-error">{error}</p>}
    {notice && <p role="status" className="pt-live-notice">{notice}</p>}
    <div className="pt-room-grid">
      {screen?.screen ? <section className="pt-live-stage"><h1>Экран показывает {screen.name}</h1><TrackView track={screen.screen} muted label="Демонстрация экрана" /></section>
        : showVideo ? <section className="pt-live-stage"><h1>Видеосвязь</h1><div className="pt-demo-video-grid">{media.participants.map(participant => <article className="pt-live-tile" key={participant.id}>
          {participant.camera ? <TrackView track={participant.camera} muted label={`Видео: ${participant.name}`} /> : <div className="pt-live-avatar">{participant.name.slice(0, 1)}</div>}
          <div className="pt-live-tile-label"><b>{participant.name}{participant.local ? " (вы)" : ""}</b></div>
        </article>)}</div></section>
        : <ClassroomBoard label={ready ? "Общая доска" : "Загружаем доску…"} strokes={strokes} accountId={session.role} canDraw={ready} canEraseAll={teacher}
          onStroke={submitStroke} onErase={strokeId => void run(() => enqueue({ action: "erase", strokeId }))} onUndo={() => void run(() => enqueue({ action: "undo" }))} />}
      <aside className="pt-room-side">
        <div className="pt-room-side-head"><h2>Участники</h2><span>{media.participants.length} из 2</span></div>
        {media.participants.map(participant => <article className="pt-live-tile" key={participant.id}>
          {participant.camera ? <TrackView track={participant.camera} muted label={`Видео: ${participant.name}`} /> : <div className="pt-live-avatar">{participant.name.slice(0, 1)}</div>}
          <div className="pt-live-tile-label"><div><b>{participant.name}{participant.local ? " (вы)" : ""}</b><small>{participant.microphoneOn ? "Микрофон включён" : "Микрофон выключен"}</small></div></div>
        </article>)}
        {media.participants.length < 2 && <p className="pt-live-notice">{teacher ? "Отправьте ученику личную ссылку. Он подключится с телефона или компьютера." : "Ожидаем преподавателя."}</p>}
        <label className="pt-room-notes">Ваши заметки<textarea maxLength={6000} value={note ?? board.notes[session.role] ?? ""} disabled={!ready}
          onChange={event => setNote(event.target.value)} onBlur={() => {
            if (note !== null) void run(async () => { await enqueue({ action: "notes", text: note }); setNote(null); setNotice("Заметка сохранена."); });
          }} placeholder="Условие, формулы или ход решения…" /></label>
        <div className="pt-peer-note"><b>Заметки {teacher ? "ученика" : "преподавателя"}</b><p>{board.notes[teacher ? "student" : "teacher"] || "Пока пусто."}</p></div>
      </aside>
    </div>
    {media.participants.map(participant => !participant.local && participant.microphone ? <TrackView key={participant.id} track={participant.microphone} audio label={`Аудио: ${participant.name}`} /> : null)}
    <footer className="pt-room-controls">
      <div className="pt-media-actions">
        <button type="button" disabled={!connected || pending} aria-pressed={Boolean(local?.microphoneOn)} onClick={() => void run(async () => { await media.room?.localParticipant.setMicrophoneEnabled(!local?.microphoneOn); })}><PhysicsIcon name="mic" size={18} /> Микрофон</button>
        <button type="button" disabled={!connected || pending} aria-pressed={Boolean(local?.cameraOn)} onClick={() => void run(async () => { await media.room?.localParticipant.setCameraEnabled(!local?.cameraOn); })}><PhysicsIcon name="video" size={18} /> Камера</button>
        <button type="button" disabled={!connected || pending} aria-pressed={Boolean(local?.screenOn)} onClick={() => void run(async () => { await media.room?.localParticipant.setScreenShareEnabled(!local?.screenOn); })}><PhysicsIcon name="screen" size={18} /> {local?.screenOn ? "Остановить показ" : "Показ экрана"}</button>
        {!media.audioAllowed && <button type="button" onClick={() => void run(async () => { await media.room?.startAudio(); })}>Включить звук</button>}
        {media.state === ConnectionState.Disconnected && <button type="button" disabled={pending} onClick={() => void run(async () => {
          const next = await request<ClassroomSession>({ action: "join" }); setSession({ ...session, ...next });
        })}>Подключиться снова</button>}
      </div>
      <button type="button" className="pt-exit" onClick={() => setConfirmExit(true)}>Покинуть урок</button>
    </footer>
    {confirmExit && <div className="pt-live-leave" role="group" aria-label="Подтверждение выхода">
      <p>{teacher ? "Можно выйти и вернуться или завершить урок для обоих участников." : "Вы сможете вернуться по той же ссылке, пока урок открыт."}</p>
      <button type="button" onClick={() => setConfirmExit(false)}>Остаться</button>
      <button type="button" onClick={onLeave}>Выйти из звонка</button>
      {teacher && <button type="button" disabled={pending} className="pt-exit" onClick={() => void run(async () => { await request({ action: "end" }); onLeave(); })}>Завершить урок для всех</button>}
    </div>}
  </main>;
}

export function DemoClassroom() {
  const [session, setSession] = useState<GuestSession | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [left, setLeft] = useState(false);
  const leave = useCallback(() => { setSession(null); setLeft(true); }, []);

  async function enter() {
    setBusy(true);
    setError("");
    try {
      const roomId = new URLSearchParams(window.location.search).get("guest");
      const access = new URLSearchParams(window.location.hash.slice(1)).get("access");
      if (roomId && !access) throw new Error("Откройте полную ссылку приглашения от преподавателя.");
      const next = await guestRequest<GuestSession>(roomId ? { action: "join", roomId } : { action: "create" }, access ?? undefined);
      if (next.guestAccess) sessionStorage.setItem(`physics-guest-invite-${next.roomId}`, next.guestAccess);
      const nextSession = { ...next, access: next.access || access || "" };
      setSession(nextSession);
      const url = new URL("/classroom", window.location.origin);
      url.searchParams.set("guest", next.roomId);
      url.hash = new URLSearchParams({ access: nextSession.access }).toString();
      window.history.replaceState(null, "", url);
      setLeft(false);
    } catch (problem) { setError(problem instanceof Error ? problem.message : "Не удалось открыть урок."); }
    finally { setBusy(false); }
  }

  if (session) return <DemoRoom initialSession={session} onLeave={leave} />;
  return <main className="pt-classroom pt-guest-lobby">
    <header className="pt-room-header"><PhysicsMark /><Link className="pt-room-return" href="/">В кабинет</Link></header>
    <section className="pt-guest-card">
      <span className="eyebrow">Виртуальный класс</span>
      <h1>{left ? "Вы вышли из урока" : "Физика. Вместе, онлайн."}</h1>
      <p>Видеосвязь, общая доска, заметки и демонстрация экрана. Преподаватель создаёт урок и отправляет ученику личную ссылку.</p>
      <div className="pt-guest-steps"><span>Создайте урок</span><span>Отправьте приглашение</span><span>Включите камеру и микрофон</span></div>
      {error && <p role="alert" className="pt-lesson-error">{error}</p>}
      <button type="button" className="pt-action" disabled={busy} onClick={() => void enter()}>{busy ? "Открываем урок…" : "Открыть онлайн-урок"}<PhysicsIcon name="video" size={18} /></button>
      <p className="pt-guest-note">Приглашение действует четыре часа. Камеру и микрофон можно включить после входа.</p>
    </section>
  </main>;
}
