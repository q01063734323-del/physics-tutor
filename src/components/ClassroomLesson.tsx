"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { User } from "firebase/auth";
import { doc, onSnapshot, type Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { classroomRequest } from "@/lib/classroom-client";
import { flushBoardCommands, queueBoardCommand, readBoardCommands } from "@/lib/studio/board-outbox";
import { classroomNotesLimit, emptyClassroomBoard, type ClassroomBoardState, type ClassroomControl, type ClassroomSession, type ClassroomStroke } from "@/lib/classroom";
import { useClassroomMedia } from "@/lib/use-classroom-media";
import type { MediaPreferences } from "@/lib/studio/model";
import { ClassroomBoard } from "./ClassroomBoard";
import { PhysicsStudio } from "./PhysicsStudio";
import { StudioDialog } from "./StudioDialog";
import s from "./PhysicsStudio.module.css";

type LessonProps = { session: ClassroomSession; user: User; preferences: MediaPreferences; onLeave: (message: string, resume?: boolean) => void };
export function ClassroomLesson({ session, user, preferences, onLeave }: LessonProps) {
  const [access, setAccess] = useState(session);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const media = useClassroomMedia(access, setNotice, setError, preferences);
  const [control, setControl] = useState<ClassroomControl | null>(null);
  const [board, setBoard] = useState<ClassroomBoardState>(emptyClassroomBoard);
  const [boardReady, setBoardReady] = useState(false);
  const [localStrokes, setLocalStrokes] = useState<ClassroomStroke[]>([]);
  const [invite, setInvite] = useState("");
  const [pending, setPending] = useState(false);
  const [confirmExit, setConfirmExit] = useState(false);
  const [noteDraft, setNoteDraft] = useState<string | null>(null);
  const [savingNote, setSavingNote] = useState(false);
  const noteTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const dirtyNote = useRef<string | null>(null);
  const outboxKey = `classroom-board:${user.uid}:${session.roomId}`;
  const libraryContext=useMemo(()=>({user,roomId:session.roomId}),[user,session.roomId]);
  const teacher = session.role === "teacher";

  useEffect(() => {
    const ref = doc(db, "classroomRooms", session.roomId);
    let expiration: ReturnType<typeof setTimeout>;
    const watch = onSnapshot(ref, snapshot => {
      const data = snapshot.data() as (ClassroomControl & { expiresAt: Timestamp }) | undefined;
      if (!data) return;
      clearTimeout(expiration);
      if (data.status === "ended") { onLeave("Урок завершён."); return; }
      if (!teacher && data.studentRemoved) { onLeave("Преподаватель завершил ваше участие."); return; }
      const remaining = data.expiresAt.toMillis() - Date.now();
      if (remaining <= 0) { onLeave("Срок урока истёк."); return; }
      expiration = setTimeout(() => onLeave("Срок урока истёк."), remaining); setControl(data);
    }, () => onLeave("Доступ к уроку закрыт. Проверь вход в аккаунт."));
    const watchBoard = onSnapshot(doc(ref, "board", "state"), snapshot => {
      const data = snapshot.data() as ClassroomBoardState | undefined; if (!data) return;
      setBoard({ strokes: data.strokes, notes: data.notes });
      setNoteDraft(draft => draft === data.notes[session.role] ? null : draft);
      setLocalStrokes(previous => previous.filter(stroke => !data.strokes.some(saved => saved.id === stroke.id))); setBoardReady(true);
    }, () => setError("Не удалось синхронизировать доску."));
    return () => { watch(); watchBoard(); clearTimeout(expiration); clearTimeout(noteTimer.current); };
  }, [onLeave, session.roomId, session.role, teacher]);
  useEffect(() => {
    let active = true;
    async function retry() {
      try {
        const records = await readBoardCommands(outboxKey);
        if (active) setLocalStrokes(previous => [...previous, ...records.flatMap(record => record.body.action === "stroke" ? [{ ...record.body.stroke as ClassroomStroke, author: user.uid }] : [])].filter((stroke, index, all) => all.findIndex(item => item.id === stroke.id) === index));
        const pending = await flushBoardCommands(outboxKey, body => classroomRequest(user, { ...body, roomId: session.roomId }));
        if (active && pending) setError("Действия доски сохранены на устройстве и ожидают отправки.");
      } catch { if (active) setError("Не удалось открыть локальную очередь доски."); }
    }
    void retry(); window.addEventListener("online", retry);
    return () => { active = false; window.removeEventListener("online", retry); };
  }, [outboxKey, user, session.roomId]);
  async function enqueue(body: Record<string, unknown>) {
    await queueBoardCommand(outboxKey, body);
    const pending = await flushBoardCommands(outboxKey, command => classroomRequest(user, { ...command, roomId: session.roomId }));
    if (pending) throw Error("Действие сохранено на устройстве и ожидает восстановления связи.");
  }
  function submitStroke(stroke: Omit<ClassroomStroke, "author">) {
    setLocalStrokes(previous => [...previous, { ...stroke, author: user.uid }]);
    void enqueue({ action: "stroke", stroke }).catch(problem => { setError(problem.message); });
  }
  async function saveNotes() {
    clearTimeout(noteTimer.current); const text = dirtyNote.current; if (text === null) return;
    dirtyNote.current = null; setSavingNote(true);
    try { await enqueue({ action: "notes", text }); }
    catch (problem) { if (dirtyNote.current === null) dirtyNote.current = text; throw problem; }
    finally { setSavingNote(false); }
  }
  function updateNotes(text: string) {
    dirtyNote.current = text; setNoteDraft(text); clearTimeout(noteTimer.current);
    noteTimer.current = setTimeout(() => void saveNotes().catch(problem => setError(problem instanceof Error ? problem.message : "Не удалось сохранить заметку.")), 450);
  }
  async function run(action: () => Promise<unknown>) {
    if (pending) return; setPending(true); setError("");
    try { await action(); } catch (problem) { setError(problem instanceof Error ? problem.message : "Не удалось выполнить действие."); } finally { setPending(false); }
  }
  function moderate(action: string, extra?: Record<string, unknown>) { return classroomRequest(user, { action, roomId: session.roomId, ...extra }); }
  async function shareInvite() {
    const link = new URL("/classroom", window.location.origin); link.searchParams.set("room", session.roomId); setInvite(link.href);
    try { await navigator.clipboard.writeText(link.href); setNotice("Приглашение скопировано. Доступ есть только у выбранного ученика."); } catch { setNotice("Скопируй ссылку из поля приглашения."); }
  }
  return <><PhysicsStudio key={`${user.uid}:${session.roomId}`} libraryContext={libraryContext} media={media} role={session.role} accountId={user.uid} error={error} notice={notice} invitation={invite} onInvite={shareInvite} onLeave={() => setConfirmExit(true)} onReconnect={async () => setAccess(await classroomRequest<ClassroomSession>(user, { action: "join", roomId: session.roomId }))}
    board={<ClassroomBoard room={media.room} peerCanDraw={teacher?Boolean(control?.studentCanDraw):true} label={boardReady ? "Общая доска" : "Загрузка…"} strokes={[...board.strokes, ...localStrokes.filter(stroke => !board.strokes.some(saved => saved.id === stroke.id))]} accountId={user.uid} canDraw={boardReady && Boolean(control) && (teacher || Boolean(control?.studentCanDraw))} canEraseAll={teacher} onStroke={submitStroke} onErase={strokeId => enqueue({ action: "erase", strokeId })} onUndo={() => void run(() => enqueue({ action: "undo" }))} onClear={() => enqueue({action:"clear"})}/>}
    resources={<>{teacher && control && <div className="pt-live-moderation" role="group" aria-label="Управление учеником"><button type="button" disabled={pending || control.studentRemoved} onClick={() => void run(() => moderate("drawing", { enabled: !control.studentCanDraw }))}>{control.studentCanDraw ? "Приостановить рисование ученика" : "Разрешить рисование ученику"}</button><button type="button" disabled={pending || !media.participants.some(participant => !participant.local && participant.microphoneOn)} onClick={() => void run(() => moderate("mute"))}>Выключить микрофон ученика</button><button type="button" disabled={pending || control.studentRemoved} onClick={() => void run(() => moderate("remove"))}>Удалить ученика из урока</button></div>}<label className="pt-room-notes">Ваши заметки<textarea value={noteDraft ?? board.notes[session.role] ?? ""} maxLength={classroomNotesLimit} disabled={!boardReady} onBlur={() => void saveNotes().catch(problem => setError(problem.message))} onChange={event => updateNotes(event.target.value)} placeholder="Условие, формулы или ход решения…"/>{savingNote && <small role="status">Сохраняем…</small>}</label><div className="pt-peer-note"><b>Заметки {teacher ? "ученика" : "преподавателя"}</b><p>{board.notes[teacher ? "student" : "teacher"] || "Пока пусто."}</p></div></>}/>
    {confirmExit && <StudioDialog title="Выйти из студии?" id="studio-exit-title" onClose={() => setConfirmExit(false)}><p>{teacher ? "Можно выйти и вернуться по ссылке или завершить урок для обоих участников." : "Ты сможешь вернуться по той же ссылке, пока урок открыт."}</p>{error && <p role="alert" className={s.error}>{error}</p>}<button type="button" onClick={() => setConfirmExit(false)}>Остаться</button><button type="button" disabled={pending} onClick={() => void run(async () => { await saveNotes(); onLeave("Вы вышли из урока.", true); })}>Выйти из звонка</button>{teacher && <button type="button" className={s.leave} disabled={pending} onClick={() => void run(async () => { await saveNotes(); await moderate("end"); onLeave("Урок завершён."); })}>Завершить урок для всех</button>}</StudioDialog>}
  </>;
}
