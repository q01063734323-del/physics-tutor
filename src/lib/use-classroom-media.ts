"use client";

import { useEffect, useState } from "react";
import { ConnectionState, Room, RoomEvent, Track, type Participant } from "livekit-client";
import { cameraCapture, enableStudioCamera } from "./studio/quality";
import type { MediaPreferences } from "./studio/model";
import type { ClassroomSession } from "./classroom";

export type ClassroomParticipant = {
  id: string;
  name: string;
  local: boolean;
  camera?: Track;
  microphone?: Track;
  screen?: Track;
  microphoneOn: boolean;
  cameraOn: boolean;
  screenOn: boolean;
  speaking?: boolean;
  quality?: string;
  role?: "teacher" | "student";
};

function describeParticipant(participant: Participant, local: boolean): ClassroomParticipant {
  const camera = participant.getTrackPublication(Track.Source.Camera);
  const mic = participant.getTrackPublication(Track.Source.Microphone);
  const screen = participant.getTrackPublication(Track.Source.ScreenShare);
  return {
    id: participant.identity,
    speaking: participant.isSpeaking,
    quality: participant.connectionQuality,
    role: (() => { try { const role = JSON.parse(participant.metadata || "{}").role; return role === "teacher" || role === "student" ? role : undefined; } catch { return undefined; } })(),
    name: participant.name || (local ? "Вы" : "Собеседник"),
    local,
    camera: camera?.isMuted ? undefined : camera?.track,
    microphone: mic?.isMuted ? undefined : mic?.track,
    screen: screen?.isMuted ? undefined : screen?.track,
    microphoneOn: participant.isMicrophoneEnabled,
    cameraOn: participant.isCameraEnabled,
    screenOn: participant.isScreenShareEnabled,
  };
}

export type ClassroomMediaState = {
  room: Room | null;
  state: ConnectionState;
  participants: ClassroomParticipant[];
  audioAllowed: boolean;
};

const initialMedia: ClassroomMediaState = { room: null, state: ConnectionState.Connecting, participants: [], audioAllowed: true };

export function useClassroomMedia(session: ClassroomSession, notice: (message: string) => void, error: (message: string) => void, enableDevices: boolean | MediaPreferences = true) {
  const [media, setMedia] = useState(initialMedia);
  useEffect(() => {
    let active = true;
    const preferences = typeof enableDevices === "boolean" ? { camera: enableDevices, microphone: enableDevices } : enableDevices;
    const room = new Room({ adaptiveStream: {pixelDensity:"screen"}, dynacast: true,
      videoCaptureDefaults: cameraCapture,
      audioOutput: preferences.speakerId ? { deviceId: preferences.speakerId } : undefined,
      publishDefaults: { videoEncoding: { maxBitrate: 1_800_000, maxFramerate: 30 }, screenShareEncoding: { maxBitrate: 4_000_000, maxFramerate: 15 } },
    });
    function release() {
      for (const publication of room.localParticipant.trackPublications.values()) publication.track?.stop();
      void room.disconnect(true);
    }
    window.addEventListener("pagehide", release);
    function sync() {
      if (!active) return;
      setMedia({
        room,
        state: room.state,
        participants: room.state === ConnectionState.Disconnected ? [] : [
          describeParticipant(room.localParticipant, true),
          ...Array.from(room.remoteParticipants.values(), participant => describeParticipant(participant, false)),
        ],
        audioAllowed: room.canPlaybackAudio,
      });
    }
    const events = [
      RoomEvent.ConnectionStateChanged, RoomEvent.TrackPublished, RoomEvent.TrackUnpublished,
      RoomEvent.TrackSubscribed, RoomEvent.TrackUnsubscribed, RoomEvent.TrackMuted, RoomEvent.TrackUnmuted,
      RoomEvent.ActiveSpeakersChanged, RoomEvent.ConnectionQualityChanged,
      RoomEvent.LocalTrackPublished, RoomEvent.LocalTrackUnpublished, RoomEvent.AudioPlaybackStatusChanged,
    ] as const;
    for (const event of events) room.on(event, sync);
    room.on(RoomEvent.ParticipantConnected, participant => { notice(`${participant.name || "Участник"} подключился.`); sync(); });
    room.on(RoomEvent.ParticipantDisconnected, participant => { notice(`${participant.name || "Участник"} вышел из звонка.`); sync(); });
    room.on(RoomEvent.Reconnected, () => { notice("Связь восстановлена."); sync(); });
    room.on(RoomEvent.Disconnected, reason => { notice(reason ? `Связь завершена: ${reason}.` : "Связь завершена."); sync(); });
    room.connect(session.url, session.token).then(async () => {
      if (!active) { release(); return; }
      if (preferences.camera || preferences.microphone) {
        const results = await Promise.allSettled([
          preferences.camera ? enableStudioCamera(room,true,preferences.cameraId) : Promise.resolve(),
          preferences.microphone ? room.localParticipant.setMicrophoneEnabled(true, { deviceId: preferences.microphoneId, echoCancellation: true, noiseSuppression: true }) : Promise.resolve(),
        ]);
        if (!active) { release(); return; }
        const failed = results.find(result => result.status === "rejected");
        if (active && failed?.status === "rejected") error(classroomMediaError(failed.reason, "Проверьте камеру и микрофон. Их можно включить кнопками ниже."));
      }
      sync();
    }).catch(() => {
      if (!active) return;
      sync();
      error("Не удалось подключиться к звонку. Попробуйте подключиться снова.");
    });
    return () => {
      active = false;
      room.removeAllListeners();
      window.removeEventListener("pagehide", release);
      release();
    };
  }, [session.token, session.url, notice, error, enableDevices]);
  return media;
}

export function classroomMediaError(problem: unknown, fallback: string) {
  const name = problem instanceof Error ? problem.name : "";
  if (name === "NotAllowedError" || name === "PermissionDeniedError") {
    return "Браузер не предоставил доступ. Проверьте разрешения и повторите действие.";
  }
  if (name === "TimeoutError") return "Браузер ожидает разрешения на устройство. Проверь запрос доступа и повтори проверку.";
  if (name === "NotFoundError" || name === "DevicesNotFoundError") return "Подходящее устройство не найдено.";
  if (name === "NotReadableError" || name === "TrackStartError") return "Устройство занято или недоступно. Проверьте настройки браузера.";
  if (name === "AbortError") return "Действие отменено.";
  return fallback;
}
