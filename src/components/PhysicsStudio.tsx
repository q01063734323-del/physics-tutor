"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties, type PointerEvent, type ReactNode } from "react";
import { ConnectionState, RoomEvent, type RemoteParticipant, type Track } from "livekit-client";
import type { ClassroomRole } from "@/lib/classroom";
import type { ClassroomMediaState, ClassroomParticipant } from "@/lib/use-classroom-media";
import { classroomMediaError } from "@/lib/use-classroom-media";
import { chatLimit, chatTopic, clamp, defaultLayout, normalizeLayout, readChatPacket, type Point, type StudioMessage } from "@/lib/studio/model";
import { StudioDialog } from "./StudioDialog";
import { StudioIcon } from "./StudioIcon";
import s from "./PhysicsStudio.module.css";

export function StudioTrack({ track, audio = false, label }: { track: Track; audio?: boolean; label: string }) {
  const ref = useRef<HTMLMediaElement>(null);
  useEffect(() => { const element = ref.current; if (!element) return; track.attach(element); return () => { track.detach(element); }; }, [track]);
  return audio ? <audio ref={ref as React.Ref<HTMLAudioElement>} autoPlay aria-label={label}/> : <video ref={ref as React.Ref<HTMLVideoElement>} muted playsInline autoPlay aria-label={label}/>;
}
const connectionLabels: Record<ConnectionState, string> = {
  [ConnectionState.Connecting]: "Подключение", [ConnectionState.Connected]: "На связи", [ConnectionState.Disconnected]: "Связь прервана",
  [ConnectionState.Reconnecting]: "Переподключение", [ConnectionState.SignalReconnecting]: "Переподключение",
};

function CameraCard({ participant, floating, position, onMove }: { participant: ClassroomParticipant; floating: boolean; position: Point; onMove: (point: Point) => void }) {
  const card = useRef<HTMLElement>(null);
  const drag = useRef<{ x: number; y: number; start: Point; width: number; height: number } | null>(null);
  function begin(event: PointerEvent<HTMLButtonElement>) {
    const bounds = card.current?.parentElement?.getBoundingClientRect(), rect = card.current?.getBoundingClientRect();
    if (!bounds || !rect) return;
    event.currentTarget.setPointerCapture(event.pointerId); drag.current = { x: event.clientX, y: event.clientY, start: position, width: Math.max(1, bounds.width - rect.width), height: Math.max(1, bounds.height - rect.height) };
  }
  function move(event: PointerEvent<HTMLButtonElement>) {
    const origin = drag.current; if (!origin) return;
    onMove({ x: clamp(origin.start.x + (event.clientX - origin.x) / origin.width, 0, 1), y: clamp(origin.start.y + (event.clientY - origin.y) / origin.height, 0, 1) });
  }
  return <article ref={card} className={`${s.camera} ${participant.speaking ? s.speaking : ""} ${floating ? s.floating : ""}`} style={floating ? { left: `${position.x * 100}%`, top: `${position.y * 100}%`, transform: `translate(-${position.x * 100}%, -${position.y * 100}%)` } : undefined}>
    <div className={s.cameraImage}>{participant.camera ? <StudioTrack track={participant.camera} label={`Видео: ${participant.name}`}/> : <div className={s.cameraAvatar}><span>{participant.name.slice(0, 1).toUpperCase()}</span><small>Камера выключена</small></div>}<span className={s.micBadge} title={participant.microphoneOn ? "Микрофон включён" : "Микрофон выключен"}><StudioIcon name="mic" off={!participant.microphoneOn}/></span></div>
    <footer><div><b>{participant.name}{participant.local ? " · вы" : ""}</b><small>{participant.role === "teacher" ? "Преподаватель" : participant.role === "student" ? "Ученик" : "Участник"} · {participant.quality === "poor" || participant.quality === "lost" ? "Слабая сеть" : participant.speaking ? "Говорит" : "В уроке"}</small></div>{floating && <button type="button" className={s.dragHandle} aria-label={`Переместить камеру: ${participant.name}`} title="Перетащите или используйте стрелки" onPointerDown={begin} onPointerMove={move} onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }} onKeyDown={event => { const delta: Record<string, Point> = { ArrowLeft: { x: -.05, y: 0 }, ArrowRight: { x: .05, y: 0 }, ArrowUp: { x: 0, y: -.05 }, ArrowDown: { x: 0, y: .05 } }; if (delta[event.key]) { event.preventDefault(); onMove({ x: clamp(position.x + delta[event.key].x, 0, 1), y: clamp(position.y + delta[event.key].y, 0, 1) }); } }}><StudioIcon name="move"/></button>}</footer>
  </article>;
}

function StudioControl({ icon, label, onClick, active = false, disabled = false, badge = 0, off = false }: { icon: Parameters<typeof StudioIcon>[0]["name"]; label: string; onClick: () => void; active?: boolean; disabled?: boolean; badge?: number; off?: boolean }) {
  return <button type="button" title={label} aria-label={label} aria-pressed={active} disabled={disabled} onClick={onClick} className={active ? s.controlActive : ""}><StudioIcon name={icon} off={off}/><span>{label}</span>{badge > 0 && <b className={s.badge}>{badge > 99 ? "99+" : badge}</b>}</button>;
}

type Props = {
  media: ClassroomMediaState; role: ClassroomRole; accountId: string; board: ReactNode; resources: ReactNode;
  error?: string; notice?: string; invitation?: string; onInvite?: () => void; onLeave: () => void; onReconnect?: () => Promise<void>; preview?: boolean;
};
export function PhysicsStudio({ media, role, accountId, board, resources, error, notice, invitation, onInvite, onLeave, onReconnect, preview = false }: Props) {
  const root = useRef<HTMLElement>(null);
  const [layout, setLayout] = useState(defaultLayout);
  const [layoutReady, setLayoutReady] = useState(false);
  const [workspace, setWorkspace] = useState<"video" | "board">("video");
  const [dismissedScreen, setDismissedScreen] = useState<Track>();
  const [panel, setPanel] = useState<"chat" | "devices" | "layout" | "resources" | null>(null);
  const [messages, setMessages] = useState<StudioMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [unread, setUnread] = useState(0);
  const [pending, setPending] = useState("");
  const [localError, setLocalError] = useState("");
  const [showShareChoice, setShowShareChoice] = useState(false);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [deviceIds, setDeviceIds] = useState<Record<string, string>>({});
  const [fullscreen, setFullscreen] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const chatScroll = useRef<HTMLDivElement>(null);
  const followChat = useRef(true);
  const panelRef = useRef(panel);
  useEffect(() => { panelRef.current = panel; }, [panel]);
  const idle = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const local = media.participants.find(participant => participant.local);
  const teacher = role === "teacher";
  const connected = media.state === ConnectionState.Connected && !preview;
  const screenOwner = media.participants.find(participant => participant.screen && !participant.local) || media.participants.find(participant => participant.screen);
  const screen = screenOwner?.screen;
  const presentation = Boolean(screen && dismissedScreen !== screen);
  const floating = layout.mode !== "studio";
  const allCameras = [...media.participants].sort((a, b) => Number(b.role === "teacher") - Number(a.role === "teacher"));
  const cameraKey = (participant: ClassroomParticipant) => participant.role || (participant.local ? "local" : "peer");
  const cameras = allCameras.filter(participant => !layout.hidden.includes(cameraKey(participant)));
  const layoutKey = `physics-studio-layout-v1:${accountId}`;

  useEffect(() => {
    let saved = defaultLayout; try { saved = normalizeLayout(JSON.parse(localStorage.getItem(layoutKey) || "null")); } catch { /* defaults */ }
    queueMicrotask(() => { setLayout(saved); setLayoutReady(true); });
  }, [layoutKey]);
  useEffect(() => { if (layoutReady) try { localStorage.setItem(layoutKey, JSON.stringify(layout)); } catch { /* Layout is still usable without persistence. */ } }, [layout, layoutReady, layoutKey]);
  useEffect(() => {
    const update = () => setFullscreen(document.fullscreenElement === root.current);
    document.addEventListener("fullscreenchange", update); return () => document.removeEventListener("fullscreenchange", update);
  }, []);
  const showControls = useCallback(() => {
    setControlsVisible(true); clearTimeout(idle.current);
    idle.current = setTimeout(() => { if (!root.current?.querySelector("button:focus, input:focus, select:focus, textarea:focus") && !panelRef.current) setControlsVisible(false); }, 3500);
  }, []);
  useEffect(() => { queueMicrotask(showControls); return () => clearTimeout(idle.current); }, [showControls, layout.mode]);
  useEffect(() => {
    if (!media.room) return;
    const room = media.room;
    const receive = (payload: Uint8Array, participant?: RemoteParticipant, _kind?: unknown, topic?: string) => {
      if (topic !== chatTopic || !participant || !room.remoteParticipants.has(participant.identity)) return;
      const packet = readChatPacket(payload); if (!packet) return;
      const message: StudioMessage = { ...packet, at: Date.now(), sender: participant.identity, name: participant.name || "Участник", local: false };
      setMessages(previous => previous.some(item => item.id === message.id && item.sender === message.sender) ? previous : [...previous, message].slice(-200));
      if (panelRef.current !== "chat") setUnread(value => value + 1);
    };
    room.on(RoomEvent.DataReceived, receive); return () => { room.off(RoomEvent.DataReceived, receive); };
  }, [media.room]);
  useEffect(() => { if (panel === "chat" && followChat.current && chatScroll.current) chatScroll.current.scrollTop = chatScroll.current.scrollHeight; }, [messages, panel]);
  useEffect(() => {
    if (panel !== "devices") return;
    const service = navigator.mediaDevices; let mounted = true;
    const refresh = () => { void service?.enumerateDevices().then(items => { if (mounted) setDevices(items); }).catch(() => undefined); };
    refresh(); service?.addEventListener("devicechange", refresh);
    return () => { mounted = false; service?.removeEventListener("devicechange", refresh); };
  }, [panel]);
  async function run(action: string, operation: () => Promise<unknown>) {
    if (pending) return; setPending(action); setLocalError("");
    try { await operation(); } catch (problem) { setLocalError(classroomMediaError(problem, problem instanceof Error ? problem.message : "Не удалось выполнить действие.")); } finally { setPending(""); }
  }
  async function sendChat() {
    const text = draft.trim(); if (!text || !connected || !media.room || pending) return;
    const packet = { id: crypto.randomUUID(), text: text.slice(0, chatLimit), at: Date.now() };
    await run("chat", async () => {
      await media.room!.localParticipant.publishData(new TextEncoder().encode(JSON.stringify(packet)), { reliable: true, topic: chatTopic });
      setMessages(previous => [...previous, { ...packet, sender: local?.id || accountId, name: local?.name || "Вы", local: true }].slice(-200)); setDraft(""); followChat.current = true;
    });
  }
  const togglePanel = useCallback((next: "chat" | "devices" | "layout" | "resources") => { showControls(); setPanel(previous => previous === next ? null : next); if (next === "chat") { setUnread(0); followChat.current = true; } }, [showControls]);
  const toggleFullscreen = useCallback(async () => {
    try { if (document.fullscreenElement) await document.exitFullscreen(); else if (root.current?.requestFullscreen) await root.current.requestFullscreen(); else throw new Error("Полный экран недоступен в этом браузере. Поверни устройство горизонтально."); }
    catch (problem) { setLocalError(problem instanceof Error ? problem.message : "Полный экран недоступен."); }
  }, []);
  async function shareScreen() {
    if (!teacher || !connected || !media.room) return;
    if (!navigator.mediaDevices?.getDisplayMedia) { setLocalError("Этот браузер не поддерживает захват экрана. Смотреть презентацию можно; для показа открой класс на компьютере."); return; }
    await run("share", async () => {
      await media.room!.localParticipant.setScreenShareEnabled(true, { audio: false, contentHint: "detail", selfBrowserSurface: "exclude", video: { displaySurface: "window" }, systemAudio: "exclude" });
      setDismissedScreen(undefined); setShowShareChoice(false);
    });
  }
  function renderCamera(participant: ClassroomParticipant, index: number) {
    const key = cameraKey(participant);
    return <CameraCard key={participant.id} participant={participant} floating={floating} position={layout.positions[key] || { x: 1, y: index ? 1 : 0 }} onMove={point => setLayout(previous => ({ ...previous, positions: { ...previous.positions, [key]: point } }))}/>;
  }
  return <main ref={root} className={`${s.studio} ${layout.mode === "cinema" ? s.cinema : ""}`} style={{ "--rail-width": `${layout.railWidth}px`, "--camera-width": `${layout.cameraWidth}px` } as CSSProperties} onPointerMove={showControls} onFocusCapture={showControls} onKeyDown={event => { if (event.key === "Escape") { setPanel(null); setShowShareChoice(false); showControls(); } }}>
    <header className={s.header}><div className={s.brand}><span className={s.brandMark}>φ</span><div><b>PHYSICS STUDIO</b><small>MIDNIGHT LABORATORY</small></div></div><div className={s.lessonStatus}><i className={connected ? s.online : ""}/><span role="status">{preview ? "Предпросмотр · без звонка" : connectionLabels[media.state]}</span><small>{media.participants.length} / 2</small></div>{onInvite && teacher && <button type="button" onClick={onInvite}>Пригласить ученика <StudioIcon name="arrow"/></button>}</header>
    {preview && <p className={s.previewNotice}>Предпросмотр интерфейса. Камеры, чат и демонстрация здесь не подключены к звонку.</p>}
    {(error || localError) && <div className={s.error} role="alert">{error || localError}<button type="button" onClick={() => setLocalError("")}>Закрыть</button></div>}
    {notice && <p className={s.notice} role="status">{notice}</p>}
    {invitation && <label className={s.invitation}>Личное приглашение ученика<input type="url" value={invitation} readOnly onFocus={event => event.target.select()}/></label>}
    <div className={s.workspaceBar}><div className={s.segmented} role="group" aria-label="Рабочая область"><button type="button" aria-pressed={presentation} disabled={!screen} onClick={() => setDismissedScreen(undefined)}>Презентация</button><button type="button" aria-pressed={!presentation && workspace === "video"} onClick={() => { setDismissedScreen(screen); setWorkspace("video"); }}>Видеозвонок</button><button type="button" aria-pressed={!presentation && workspace === "board"} onClick={() => { setDismissedScreen(screen); setWorkspace("board"); }}>Доска</button></div><span className={presentation ? s.sharingStatus : s.muted}>{presentation ? `Идёт демонстрация · ${screenOwner?.name}` : "Индивидуальное занятие"}</span></div>
    <div className={`${s.roomGrid} ${presentation || workspace === "board" ? s.contentGrid : ""} ${floating ? s.freeGrid : ""} ${panel ? s.withPanel : ""}`}>
      <section className={s.stage} aria-label="Центральная рабочая область">
        {presentation && screen ? <div className={s.presentation}><StudioTrack track={screen} label={`Презентация: ${screenOwner?.name}`}/><span className={s.presentationLabel}>LIVE · {screenOwner?.name}</span></div> : workspace === "board" ? <div className={s.board}>{board}</div> : <div className={s.conversation}>{cameras.length ? cameras.map(participant => <CameraCard key={participant.id} participant={participant} floating={false} position={{ x: 0, y: 0 }} onMove={() => undefined}/>) : <div className={s.waiting}><span className={s.brandMark}>φ</span><h1>{preview ? "Пространство для больших идей." : media.state === ConnectionState.Connecting ? "Открываем твою студию…" : "Здесь начинается понимание."}</h1><p>{preview ? "PowerPoint, общая доска и разговор о физике." : "Подключение к видеосвязи появится здесь."}</p></div>}{cameras.length === 1 && <div className={s.waiting}><span className={s.waitingRing}/><h2>{teacher ? "Ждём ученика" : "Ждём преподавателя"}</h2><p>{teacher ? "Приглашение откроет урок только для выбранного ученика." : "Можно проверить камеру и микрофон, пока преподаватель подключается."}</p></div>}</div>}
        {floating && layout.cameras && (presentation || workspace === "board") && <div className={s.floatingCameras}>{cameras.map(renderCamera)}</div>}
      </section>
      {!floating && layout.cameras && (presentation || workspace === "board") && <aside className={s.cameraRail}><div className={s.railTitle}>В студии <span>{cameras.length}/2</span></div>{cameras.map(renderCamera)}{cameras.length < 2 && <div className={s.waitingSmall}>Ожидаем второго участника</div>}</aside>}
      {panel && <aside className={s.sidePanel} aria-label={panel === "chat" ? "Чат урока" : panel === "devices" ? "Настройки устройств" : panel === "layout" ? "Расположение панелей" : "Материалы урока"}><header><h2>{panel === "chat" ? "Чат урока" : panel === "devices" ? "Устройства" : panel === "layout" ? "Твоя студия" : "Материалы урока"}</h2><button type="button" aria-label="Закрыть панель" onClick={() => setPanel(null)}><StudioIcon name="close"/></button></header>
        {panel === "chat" && <><div className={s.messages} ref={chatScroll} onScroll={event => { const element = event.currentTarget; followChat.current = element.scrollHeight - element.scrollTop - element.clientHeight < 64; }}>{!messages.length && <div className={s.chatEmpty}><StudioIcon name="chat"/><h3>Продолжение мысли.</h3><p>Отправь формулу или вопрос. Чат доступен участникам текущего звонка и не сохраняется после выхода.</p></div>}{messages.map(message => <article key={`${message.sender}:${message.id}`} className={message.local ? s.ownMessage : ""}><div><b>{message.name}</b><time>{new Date(message.at).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}</time></div><p>{message.text}</p></article>)}</div><form className={s.chatForm} onSubmit={event => { event.preventDefault(); void sendChat(); }}><label className={s.srOnly} htmlFor="studio-chat">Сообщение в чат</label><textarea id="studio-chat" maxLength={chatLimit} placeholder="Напиши сообщение…" value={draft} disabled={!connected} onChange={event => setDraft(event.target.value)}/><button type="submit" className={s.primary} disabled={!connected || !draft.trim() || !!pending}>Отправить <StudioIcon name="arrow"/></button></form></>}
        {panel === "devices" && <div className={s.panelBody}>{([["videoinput", "Камера"], ["audioinput", "Микрофон"], ["audiooutput", "Динамики"]] as const).map(([kind, label]) => <label key={kind}>{label}<select value={deviceIds[kind] || ""} disabled={!connected || !!pending || !devices.some(device => device.kind === kind && device.deviceId) || kind === "audiooutput" && !("setSinkId" in HTMLMediaElement.prototype)} onChange={event => { const id = event.target.value; void run("device", async () => { const changed = await media.room?.switchActiveDevice(kind, id, false); if (!changed) throw new Error("Браузер не смог переключить устройство."); setDeviceIds(previous => ({ ...previous, [kind]: id })); }); }}><option value="" disabled>По умолчанию</option>{devices.filter(device => device.kind === kind && device.deviceId).map((device, index) => <option key={device.deviceId} value={device.deviceId}>{device.label || `${label} ${index + 1}`}</option>)}</select></label>)}<p className={s.muted}>Выбор динамиков поддерживается не всеми браузерами. Если список недоступен, используй настройки звука устройства.</p></div>}
        {panel === "layout" && <div className={s.panelBody}><p className={s.muted}>Расположение сохраняется на этом устройстве. Перемещай камеры за ручку или стрелками клавиатуры.</p><div className={s.layoutChoices}>{([['studio', 'Studio', 'Контент и камеры рядом'], ['cinema', 'Cinema', 'Максимум места презентации'], ['free', 'Free layout', 'Камеры там, где удобно']] as const).map(([mode, label, description]) => <button type="button" key={mode} aria-pressed={layout.mode === mode} onClick={() => { setLayout(previous => ({ ...previous, mode })); if (mode === "cinema" && !fullscreen && !preview) void toggleFullscreen(); }}><b>{label}</b><span>{description}</span></button>)}</div><label>Ширина панели камер<input type="range" min={180} max={340} value={layout.railWidth} onChange={event => setLayout(previous => ({ ...previous, railWidth: Number(event.target.value) }))}/></label><label>Размер плавающих камер<input type="range" min={140} max={300} value={layout.cameraWidth} onChange={event => setLayout(previous => ({ ...previous, cameraWidth: Number(event.target.value) }))}/></label><button type="button" aria-pressed={layout.cameras} onClick={() => setLayout(previous => ({ ...previous, cameras: !previous.cameras }))}>{layout.cameras ? "Скрыть камеры" : "Показать камеры"}</button>{allCameras.map(participant => { const key = cameraKey(participant); return <button type="button" key={participant.id} aria-pressed={!layout.hidden.includes(key)} onClick={() => setLayout(previous => ({ ...previous, hidden: previous.hidden.includes(key) ? previous.hidden.filter(item => item !== key) : [...previous.hidden, key] }))}>{layout.hidden.includes(key) ? "Показать" : "Скрыть"} камеру: {participant.name}</button>; })}<button type="button" onClick={() => setLayout({ ...defaultLayout, positions: {} })}>Сбросить расположение</button></div>}
        {panel === "resources" && <div className={s.panelBody}>{resources}</div>}
      </aside>}
    </div>
    {media.participants.filter(participant => !participant.local && participant.microphone).map(participant => <StudioTrack key={participant.id} track={participant.microphone!} audio label={`Звук: ${participant.name}`}/>)}
    {!media.audioAllowed && <button type="button" className={s.audioUnlock} onClick={() => void run("audio", async () => { await media.room?.startAudio(); })}>Браузер приостановил звук · включить</button>}
    {media.state === ConnectionState.Disconnected && onReconnect && <button type="button" className={s.audioUnlock} disabled={!!pending} onClick={() => void run("reconnect", onReconnect)}>Подключиться снова</button>}
    <footer className={`${s.dock} ${layout.mode === "cinema" && !controlsVisible && !panel && !showShareChoice ? s.dockHidden : ""}`} aria-label="Управление звонком" onPointerEnter={showControls}>
      <StudioControl icon="mic" label={local?.microphoneOn ? "Выключить микрофон" : "Включить микрофон"} onClick={() => void run("mic", async () => { await media.room?.localParticipant.setMicrophoneEnabled(!local?.microphoneOn); })} active={Boolean(local?.microphoneOn)} off={!local?.microphoneOn} disabled={!connected || !!pending}/>
      <StudioControl icon="camera" label={local?.cameraOn ? "Выключить камеру" : "Включить камеру"} onClick={() => void run("camera", async () => { await media.room?.localParticipant.setCameraEnabled(!local?.cameraOn); })} active={Boolean(local?.cameraOn)} off={!local?.cameraOn} disabled={!connected || !!pending}/>
      {teacher && <StudioControl icon="share" label={local?.screenOn ? "Остановить показ" : "Демонстрировать экран"} onClick={() => { if (local?.screenOn) void run("share", async () => { await media.room?.localParticipant.setScreenShareEnabled(false); }); else setShowShareChoice(true); }} active={Boolean(local?.screenOn)} disabled={!connected || !!pending}/>}
      <i className={s.dockDivider}/><StudioControl icon="chat" label="Чат" onClick={() => togglePanel("chat")} active={panel === "chat"} badge={unread}/><StudioControl icon="layout" label="Расположение" onClick={() => togglePanel("layout")} active={panel === "layout"}/><StudioControl icon="board" label="Материалы" onClick={() => togglePanel("resources")} active={panel === "resources"}/><StudioControl icon="expand" label={fullscreen ? "Выйти из полного экрана" : "Полный экран"} onClick={() => void toggleFullscreen()} active={fullscreen}/><StudioControl icon="settings" label="Устройства" onClick={() => togglePanel("devices")} active={panel === "devices"}/><button type="button" className={s.leave} title="Выйти из звонка" aria-label="Выйти из звонка" onClick={onLeave}><StudioIcon name="leave"/><span>Завершить</span></button>
    </footer>
    {showShareChoice && <StudioDialog title="Покажем идею целиком." id="studio-share-title" onClose={() => setShowShareChoice(false)}><p className={s.eyebrow}>POWERPOINT · CONTENT FIRST</p><p>На следующем шаге браузер предложит окно, вкладку или экран. Выбери окно показа слайдов PowerPoint — так личные окна останутся за кадром.</p><p className={s.muted}>Слайды переключаются в PowerPoint. Системный звук в этой версии не передаётся. На телефоне захват может быть недоступен.</p><button type="button" className={s.primary} disabled={!!pending} onClick={() => void shareScreen()}>Выбрать окно презентации <StudioIcon name="share"/></button><button type="button" onClick={() => setShowShareChoice(false)}>Отмена</button></StudioDialog>}
  </main>;
}
