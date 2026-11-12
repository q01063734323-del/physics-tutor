"use client";

import { useEffect, useRef, useState } from "react";
import { ConnectionState, type Track } from "livekit-client";
import type { User } from "firebase/auth";
import { doc, onSnapshot, type Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { classroomRequest } from "@/lib/classroom-client";
import {
  classroomNotesLimit, emptyClassroomBoard, type ClassroomBoardState, type ClassroomControl,
  type ClassroomSession, type ClassroomStroke,
} from "@/lib/classroom";
import { classroomMediaError, useClassroomMedia, type ClassroomParticipant } from "@/lib/use-classroom-media";
import { ClassroomBoard } from "./ClassroomBoard";
import { PhysicsIcon, PhysicsMark } from "./PhysicsMark";

type LessonProps = { session: ClassroomSession; user: User; onLeave: (message: string, resume?: boolean) => void };
type Workspace = "board" | "screen" | "video";
type MediaKind = "videoinput" | "audioinput" | "audiooutput";

function AttachedTrack({ track, muted, audio = false, label }: { track: Track; muted?: boolean; audio?: boolean; label: string }) {
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

function ParticipantTile({ participant, expand }: { participant: ClassroomParticipant; expand: () => void }) {
  return (
    <div className="pt-live-tile">
      {participant.camera ? <AttachedTrack track={participant.camera} muted label={`Видео: ${participant.name}`} />
        : <div className="pt-live-avatar" aria-label="Камера выключена">{participant.name.slice(0, 1).toUpperCase()}</div>}
      <div className="pt-live-tile-label">
        <div><b>{participant.name}{participant.local ? " (вы)" : ""}</b><small>{participant.microphoneOn ? "Микрофон включён" : "Микрофон выключен"}</small></div>
        <button type="button" onClick={expand} disabled={!participant.camera} aria-label={`Развернуть видео: ${participant.name}`}>↗</button>
      </div>
    </div>
  );
}

const stateLabel: Record<ConnectionState, string> = {
  [ConnectionState.Disconnected]: "Связь прервана",
  [ConnectionState.Connecting]: "Подключаемся…",
  [ConnectionState.Connected]: "На связи",
  [ConnectionState.Reconnecting]: "Восстанавливаем связь…",
  [ConnectionState.SignalReconnecting]: "Восстанавливаем связь…",
};

export function ClassroomLesson({ session, user, onLeave }: LessonProps) {
  const [access, setAccess] = useState(session);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const media = useClassroomMedia(access, setNotice, setError);
  const [control, setControl] = useState<ClassroomControl | null>(null);
  const [board, setBoard] = useState<ClassroomBoardState>(emptyClassroomBoard);
  const [boardReady, setBoardReady] = useState(false);
  const [localStrokes, setLocalStrokes] = useState<ClassroomStroke[]>([]);
  const [workspace, setWorkspace] = useState<Workspace>("board");
  const [expanded, setExpanded] = useState("");
  const [dismissedShare, setDismissedShare] = useState<Track>();
  const [invite, setInvite] = useState("");
  const [deviceMenu, setDeviceMenu] = useState(false);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDevices, setSelectedDevices] = useState<Partial<Record<MediaKind, string>>>({});
  const [pendingAction, setPendingAction] = useState("");
  const [confirmExit, setConfirmExit] = useState(false);
  const [noteDraft, setNoteDraft] = useState<string | null>(null);
  const [savingNote, setSavingNote] = useState(false);
  const noteTimer = useRef<number | undefined>(undefined);
  const dirtyNote = useRef<string | null>(null);
  const writeQueue = useRef<Promise<unknown>>(Promise.resolve());
  const teacher = session.role === "teacher";
  const cameraOn = Boolean(media.participants[0]?.cameraOn);
  const microphoneOn = Boolean(media.participants[0]?.microphoneOn);

  useEffect(() => {
    const ref = doc(db, "classroomRooms", session.roomId);
    let expiration: number | undefined;
    const watch = onSnapshot(ref, snapshot => {
      const data = snapshot.data() as (ClassroomControl & { expiresAt: Timestamp }) | undefined;
      if (!data) return;
      window.clearTimeout(expiration);
      if (data.status === "ended") { onLeave("Урок завершён."); return; }
      if (!teacher && data.studentRemoved) { onLeave("Преподаватель завершил ваше участие."); return; }
      const remaining = data.expiresAt.toMillis() - Date.now();
      if (remaining <= 0) { onLeave("Срок урока истёк."); return; }
      expiration = window.setTimeout(() => onLeave("Срок урока истёк."), remaining);
      setControl(data);
    }, () => onLeave("Доступ к уроку закрыт. Проверьте вход в аккаунт."));
    const watchBoard = onSnapshot(doc(ref, "board", "state"), snapshot => {
      const data = snapshot.data() as ClassroomBoardState | undefined;
      if (!data) return;
      setBoard({ strokes: data.strokes, notes: data.notes });
      setNoteDraft(draft => draft === data.notes[session.role] ? null : draft);
      setLocalStrokes(previous => previous.filter(stroke => !data.strokes.some(saved => saved.id === stroke.id)));
      setBoardReady(true);
    }, () => setError("Не удалось синхронизировать доску."));
    return () => {
      watch();
      watchBoard();
      window.clearTimeout(expiration);
      window.clearTimeout(noteTimer.current);
    };
  }, [onLeave, session.roomId, session.role, teacher]);

  useEffect(() => {
    if (!deviceMenu || !navigator.mediaDevices) return;
    const service = navigator.mediaDevices;
    let active = true;
    const update = () => { void service.enumerateDevices().then(items => { if (active) setDevices(items); }).catch(() => undefined); };
    update();
    service.addEventListener("devicechange", update);
    return () => { active = false; service.removeEventListener("devicechange", update); };
  }, [deviceMenu, cameraOn, microphoneOn]);

  function enqueue(body: Record<string, unknown>) {
    const request = writeQueue.current.catch(() => undefined).then(() => classroomRequest(user, { ...body, roomId: session.roomId }));
    writeQueue.current = request;
    return request;
  }

  function submitStroke(stroke: Omit<ClassroomStroke, "author">) {
    setLocalStrokes(previous => [...previous, { ...stroke, author: user.uid }]);
    void enqueue({ action: "stroke", stroke }).catch(problem => {
      setLocalStrokes(previous => previous.filter(item => item.id !== stroke.id));
      setError(problem.message);
    });
  }

  function changeBoard(action: "erase" | "undo", strokeId?: string) {
    void enqueue({ action, strokeId }).catch(problem => setError(problem.message));
  }

  async function saveNotes() {
    window.clearTimeout(noteTimer.current);
    const text = dirtyNote.current;
    if (text === null) return;
    dirtyNote.current = null;
    setSavingNote(true);
    try { await enqueue({ action: "notes", text }); }
    catch (problem) {
      if (dirtyNote.current === null) dirtyNote.current = text;
      setError(problem instanceof Error ? problem.message : "Не удалось сохранить заметку.");
    } finally { setSavingNote(false); }
  }

  function updateNotes(text: string) {
    dirtyNote.current = text;
    setNoteDraft(text);
    window.clearTimeout(noteTimer.current);
    noteTimer.current = window.setTimeout(() => void saveNotes(), 450);
  }

  async function run(label: string, action: () => Promise<unknown>, fallback = "Не удалось выполнить действие.") {
    if (pendingAction) return;
    setPendingAction(label);
    setError("");
    try { await action(); }
    catch (problem) { setError(classroomMediaError(problem, problem instanceof Error && label === "room" ? problem.message : fallback)); }
    finally { setPendingAction(""); }
  }

  async function shareInvite() {
    const link = new URL("/classroom", window.location.origin);
    link.searchParams.set("room", session.roomId);
    setInvite(link.href);
    try { await navigator.clipboard.writeText(link.href); setNotice("Приглашение скопировано."); }
    catch { setNotice("Скопируйте ссылку из поля приглашения."); }
  }

  const local = media.participants.find(participant => participant.local);
  const connected = media.state === ConnectionState.Connected;
  const screenOwner = media.participants.find(participant => participant.id === expanded && participant.screen)
    ?? media.participants.find(participant => participant.screen && !participant.local)
    ?? media.participants.find(participant => participant.screen);
  const videoOwner = media.participants.find(participant => participant.id === expanded && participant.camera);
  const showingScreen = screenOwner?.screen && (workspace === "screen" || (workspace === "board" && dismissedShare !== screenOwner.screen));
  const panel = showingScreen ? "screen" : workspace === "video" && videoOwner?.camera ? "video" : "board";
  const canDraw = boardReady && Boolean(control) && (teacher || Boolean(control?.studentCanDraw));
  const peerNote = board.notes[teacher ? "student" : "teacher"];
  const ownNote = noteDraft ?? board.notes[session.role] ?? "";

  function selectMedia(kind: MediaKind, id: string) {
    const room = media.room;
    if (!room) return;
    void run("device", async () => {
      const switched = await room.switchActiveDevice(kind, id, false);
      if (!switched) throw new Error();
      setSelectedDevices(previous => ({ ...previous, [kind]: id }));
    }, "Не удалось переключить устройство.");
  }

  function moderate(action: string, extra?: Record<string, unknown>) {
    return classroomRequest(user, { action, roomId: session.roomId, ...extra });
  }

  return (
    <main className="pt-classroom pt-live-room">
      <header className="pt-room-header">
        <PhysicsMark linked={false} />
        <div className="pt-room-title"><strong>Онлайн-урок</strong><span role="status">{stateLabel[media.state]}</span></div>
        <button type="button" className="pt-room-return" onClick={() => setConfirmExit(true)}>Выйти <PhysicsIcon name="arrow" size={17} /></button>
      </header>
      <div className="pt-live-toolbar">
        <div role="group" aria-label="Рабочая область">
          <button type="button" aria-pressed={panel === "board"} onClick={() => { setDismissedShare(screenOwner?.screen); setWorkspace("board"); }}>Доска</button>
          <button type="button" aria-pressed={panel === "screen"} disabled={!screenOwner?.screen} onClick={() => setWorkspace("screen")}>Демонстрация</button>
          <button type="button" aria-pressed={panel === "video"} disabled={!media.participants.some(participant => participant.camera)}
            onClick={() => {
              const camera = media.participants.find(participant => participant.camera && !participant.local)
                ?? media.participants.find(participant => participant.camera);
              if (camera) { setExpanded(camera.id); setWorkspace("video"); }
            }}>Видео</button>
        </div>
        {teacher && <button type="button" onClick={() => void shareInvite()}>Ссылка для ученика</button>}
      </div>
      {invite && <label className="pt-live-invite">Приглашение для {control?.studentName || "ученика"}
        <input type="url" value={invite} readOnly onFocus={event => event.target.select()} />
      </label>}
      {error && <p role="alert" className="pt-lesson-error">{error}</p>}
      {notice && <p role="status" className="pt-live-notice">{notice}</p>}
      <div className="pt-room-grid">
        {panel === "board" && (
          <ClassroomBoard label={boardReady ? "Общая доска" : "Загрузка…"}
            strokes={[...board.strokes, ...localStrokes.filter(stroke => !board.strokes.some(saved => saved.id === stroke.id))]}
            accountId={user.uid} canDraw={canDraw} canEraseAll={teacher} onStroke={submitStroke}
            onErase={id => changeBoard("erase", id)} onUndo={() => changeBoard("undo")} />
        )}
        {panel === "screen" && screenOwner?.screen && (
          <section className="pt-live-stage">
            <h1>Экран показывает {screenOwner.name}</h1><AttachedTrack track={screenOwner.screen} muted label="Демонстрация экрана" />
          </section>
        )}
        {panel === "video" && videoOwner?.camera && (
          <section className="pt-live-stage"><h1>Видео: {videoOwner.name}</h1><AttachedTrack track={videoOwner.camera} muted label="Видео участника" /></section>
        )}
        <aside className="pt-room-side">
          <div className="pt-room-side-head"><h2>Участники</h2><span>{media.participants.length} из 2</span></div>
          {media.participants.map(participant => <ParticipantTile key={participant.id} participant={participant}
            expand={() => { setExpanded(participant.id); setWorkspace("video"); }} />)}
          {media.participants.length < 2 && <p className="pt-live-notice">Ожидаем второго участника.</p>}
          {teacher && control && (
            <div className="pt-live-moderation" role="group" aria-label="Управление учеником">
              <button type="button" disabled={!!pendingAction || control.studentRemoved}
                onClick={() => void run("room", () => moderate("drawing", { enabled: !control.studentCanDraw }))}>
                {control.studentCanDraw ? "Приостановить рисование ученика" : "Разрешить рисование ученику"}
              </button>
              <button type="button" disabled={!!pendingAction || !media.participants.some(participant => !participant.local && participant.microphoneOn)}
                onClick={() => void run("room", () => moderate("mute"))}>Выключить микрофон ученика</button>
              <button type="button" disabled={!!pendingAction || control.studentRemoved}
                onClick={() => void run("room", () => moderate("remove"))}>Удалить ученика из урока</button>
            </div>
          )}
          <label className="pt-room-notes">Ваши заметки
            <textarea value={ownNote} maxLength={classroomNotesLimit} disabled={!boardReady} onBlur={() => void saveNotes()}
              onChange={event => updateNotes(event.target.value)} placeholder="Условие, формулы или ход решения…" />
            {savingNote && <small role="status">Сохраняем…</small>}
          </label>
          <div className="pt-peer-note"><b>Заметки {teacher ? "ученика" : "преподавателя"}</b><p>{peerNote || "Пока пусто."}</p></div>
        </aside>
      </div>
      {media.participants.map(participant => !participant.local && participant.microphone
        ? <AttachedTrack key={participant.id} track={participant.microphone} audio label={`Аудио: ${participant.name}`} /> : null)}
      <footer className="pt-room-controls">
        <div className="pt-media-actions">
          <button type="button" disabled={!connected || !!pendingAction} aria-pressed={Boolean(local?.microphoneOn)}
            onClick={() => void run("microphone", async () => { await media.room?.localParticipant.setMicrophoneEnabled(!local?.microphoneOn); }, "Микрофон недоступен.")}>
            <PhysicsIcon name="mic" size={18} /> Микрофон
          </button>
          <button type="button" disabled={!connected || !!pendingAction} aria-pressed={Boolean(local?.cameraOn)}
            onClick={() => void run("camera", async () => { await media.room?.localParticipant.setCameraEnabled(!local?.cameraOn); }, "Камера недоступна.")}>
            <PhysicsIcon name="video" size={18} /> Камера
          </button>
          <button type="button" disabled={!connected || !!pendingAction} aria-pressed={Boolean(local?.screenOn)}
            hidden={!teacher}
            onClick={() => void run("screen", async () => {
              if (!navigator.mediaDevices?.getDisplayMedia) { setError("Этот браузер не поддерживает показ экрана."); return; }
              const sharing = !local?.screenOn;
              await media.room?.localParticipant.setScreenShareEnabled(sharing);
              if (sharing) { setExpanded(user.uid); setWorkspace("screen"); }
              else setWorkspace("board");
            }, "Не удалось начать демонстрацию экрана.")}>
            <PhysicsIcon name="screen" size={18} /> {local?.screenOn ? "Остановить показ" : "Показ экрана"}
          </button>
          <button type="button" disabled={!connected} aria-expanded={deviceMenu} onClick={() => setDeviceMenu(!deviceMenu)}>Устройства</button>
          {!media.audioAllowed && <button type="button" onClick={() => void run("audio", async () => { await media.room?.startAudio(); })}>Включить звук</button>}
          {media.state === ConnectionState.Disconnected && <button type="button" disabled={!!pendingAction} onClick={() => void run("room", async () => {
            setAccess(await classroomRequest<ClassroomSession>(user, { action: "join", roomId: session.roomId }));
          })}>Подключиться снова</button>}
        </div>
        <button type="button" className="pt-exit" onClick={() => setConfirmExit(!confirmExit)}>Покинуть урок</button>
      </footer>
      {deviceMenu && (
        <div className="pt-live-devices">
          {([["videoinput", "Камера"], ["audioinput", "Микрофон"], ["audiooutput", "Динамики"]] as const).map(([kind, label]) => {
            const available = devices.filter(device => device.kind === kind && device.deviceId);
            return <label key={kind}>{label}
              <select value={selectedDevices[kind] ?? ""} disabled={!available.length || !!pendingAction}
                onChange={event => selectMedia(kind, event.target.value)}>
                <option value="" disabled>{available.length ? "По умолчанию" : "Нет доступных устройств"}</option>
                {available.map((device, index) => <option key={device.deviceId} value={device.deviceId}>{device.label || `${label} ${index + 1}`}</option>)}
              </select>
            </label>;
          })}
        </div>
      )}
      {confirmExit && (
        <div className="pt-live-leave" role="group" aria-label="Подтверждение выхода">
          <p>{teacher ? "Вы можете выйти и вернуться по ссылке или завершить урок для обоих участников." : "Вы сможете вернуться по той же ссылке, пока урок открыт."}</p>
          <button type="button" onClick={() => setConfirmExit(false)}>Остаться</button>
          <button type="button" disabled={!!pendingAction} onClick={() => void run("room", async () => {
            await saveNotes();
            onLeave("Вы вышли из урока.", true);
          })}>Выйти из звонка</button>
          {teacher && <button type="button" className="pt-exit" disabled={!!pendingAction} onClick={() => void run("room", async () => {
            await saveNotes();
            await moderate("end");
            onLeave("Урок завершён.");
          })}>Завершить урок для всех</button>}
        </div>
      )}
    </main>
  );
}
