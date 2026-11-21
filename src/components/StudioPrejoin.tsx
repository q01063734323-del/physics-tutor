"use client";
import { useEffect, useRef, useState } from "react";
import { classroomMediaError } from "@/lib/use-classroom-media";
import { defaultMediaPreferences, type MediaPreferences } from "@/lib/studio/model";
import { withMediaTimeout } from "@/lib/studio/preview-media";
import { StudioIcon } from "./StudioIcon";
import s from "./PhysicsStudio.module.css";

export function StudioPrejoin({ name, lesson, onJoin, onCancel }: { name: string; lesson: string; onJoin: (preferences: MediaPreferences) => void; onCancel: () => void }) {
  const [preferences, setPreferences] = useState(defaultMediaPreferences);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [level, setLevel] = useState(0);
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const alive = useRef(false);
  const audioContext = useRef<AudioContext | null>(null);
  const frame = useRef(0);
  function release() { cancelAnimationFrame(frame.current); stream.current?.getTracks().forEach(track => track.stop()); stream.current = null; void audioContext.current?.close().catch(() => undefined); audioContext.current = null; }
  useEffect(() => {
    alive.current = true;
    const refresh = () => { void navigator.mediaDevices?.enumerateDevices().then(items => { if (alive.current) setDevices(items); }).catch(() => undefined); };
    refresh(); navigator.mediaDevices?.addEventListener("devicechange", refresh);
    return () => { alive.current = false; release(); navigator.mediaDevices?.removeEventListener("devicechange", refresh); };
  }, []);
  async function prepare(next: MediaPreferences) {
    if (busy) return;
    setBusy(true); setError(""); release(); setLevel(0);
    if (!navigator.mediaDevices?.getUserMedia) { setError("Устройства недоступны. Открой HTTPS-версию сайта в поддерживаемом браузере."); setBusy(false); return; }
    const capture = await Promise.allSettled([
      next.camera ? withMediaTimeout(navigator.mediaDevices.getUserMedia({ video: { deviceId: next.cameraId ? { exact: next.cameraId } : undefined, width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30, max: 30 } } })) : Promise.resolve(null),
      next.microphone ? withMediaTimeout(navigator.mediaDevices.getUserMedia({ audio: { deviceId: next.microphoneId ? { exact: next.microphoneId } : undefined, echoCancellation: true, noiseSuppression: true } })) : Promise.resolve(null),
    ]);
    const tracks = capture.flatMap(result => result.status === "fulfilled" ? result.value?.getTracks() || [] : []);
    if (!alive.current) { tracks.forEach(track => track.stop()); return; }
    const media = new MediaStream(tracks); stream.current = media;
    if (video.current) { video.current.srcObject = media; void video.current.play().catch(() => undefined); }
    const actual = { ...next, camera: media.getVideoTracks().length > 0, microphone: media.getAudioTracks().length > 0 };
    setPreferences(actual);
    const failed = capture.find(result => result.status === "rejected");
    if (failed?.status === "rejected") setError(classroomMediaError(failed.reason, "Не удалось включить устройство."));
    if (actual.microphone) try {
      const context = new AudioContext(); audioContext.current = context;
      const analyser = context.createAnalyser(); analyser.fftSize = 256;
      context.createMediaStreamSource(media).connect(analyser); const samples = new Uint8Array(analyser.frequencyBinCount);
      const measure = () => { if (!alive.current || context.state === "closed") return; analyser.getByteTimeDomainData(samples); setLevel(Math.min(1, Math.sqrt(samples.reduce((sum, value) => sum + ((value - 128) / 128) ** 2, 0) / samples.length) * 4)); frame.current = requestAnimationFrame(measure); }; measure();
    } catch { setError("Микрофон доступен, но индикатор уровня в этом браузере недоступен."); }
    try { setDevices(await navigator.mediaDevices.enumerateDevices()); } catch { /* Devices can still be used with defaults. */ }
    if (alive.current) setBusy(false);
  }
  return <main className={s.prejoin}><header className={s.brand}><span className={s.brandMark}>φ</span><div><b>PHYSICS STUDIO</b><small>INTERACTIVE CLASSROOM</small></div></header><div className={s.prejoinGrid}><section className={s.prejoinPreview}><video ref={video} muted autoPlay playsInline aria-label="Предпросмотр вашей камеры" hidden={!preferences.camera}/>{!preferences.camera && <div className={s.avatar}><span>{name.slice(0, 1).toUpperCase()}</span><p>Камера выключена</p></div>}<div className={s.prejoinName}>{name}<span>Только вы видите этот предпросмотр</span></div></section><section className={s.prejoinForm}><p className={s.eyebrow}>ВСЁ ГОТОВО К ЗАНЯТИЮ</p><h1>Твоё место<br/>в студии.</h1><p>{lesson}</p><p className={s.muted}>Проверь устройства. Можно войти с выключенными камерой и микрофоном.</p><div className={s.prejoinToggles}><button type="button" disabled={busy} aria-pressed={preferences.camera} onClick={() => void prepare({ ...preferences, camera: !preferences.camera })}><StudioIcon name="camera" off={!preferences.camera}/>{preferences.camera ? "Камера включена" : "Проверить камеру"}</button><button type="button" disabled={busy} aria-pressed={preferences.microphone} onClick={() => void prepare({ ...preferences, microphone: !preferences.microphone })}><StudioIcon name="mic" off={!preferences.microphone}/>{preferences.microphone ? "Микрофон включён" : "Проверить микрофон"}</button></div><meter min={0} max={1} value={level} aria-label="Уровень микрофона"/>{([["videoinput", "Камера", "cameraId"], ["audioinput", "Микрофон", "microphoneId"], ["audiooutput", "Динамики", "speakerId"]] as const).map(([kind, label, key]) => <label key={kind}>{label}<select disabled={busy || !devices.some(device => device.kind === kind && device.deviceId)} value={preferences[key] || ""} onChange={event => { const next = { ...preferences, [key]: event.target.value }; if (kind === "audiooutput") setPreferences(next); else void prepare(next); }}><option value="">По умолчанию</option>{devices.filter(device => device.kind === kind && device.deviceId).map((device, index) => <option key={device.deviceId} value={device.deviceId}>{device.label || `${label} ${index + 1}`}</option>)}</select></label>)}{error && <p className={s.error} role="alert">{error}</p>}<button type="button" className={s.primary} disabled={busy} onClick={() => { release(); onJoin(preferences); }}>Присоединиться <StudioIcon name="arrow"/></button><button type="button" className={s.textButton} onClick={onCancel}>Вернуться к урокам</button><small className={s.muted}>Никакой записи. Камера и микрофон передаются только после присоединения.</small></section></div></main>;
}
