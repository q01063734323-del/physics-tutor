"use client";

import { useEffect, useState } from "react";
import { ConnectionState, Room, RoomEvent, Track, type Participant } from "livekit-client";
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
};

function describeParticipant(participant: Participant, local: boolean): ClassroomParticipant {
  const camera = participant.getTrackPublication(Track.Source.Camera);
  const mic = participant.getTrackPublication(Track.Source.Microphone);
  const screen = participant.getTrackPublication(Track.Source.ScreenShare);
  return {
    id: participant.identity,
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

type MediaState = {
  room: Room | null;
  state: ConnectionState;
  participants: ClassroomParticipant[];
  audioAllowed: boolean;
};

const initialMedia: MediaState = { room: null, state: ConnectionState.Connecting, participants: [], audioAllowed: true };

export function useClassroomMedia(session: ClassroomSession, notice: (message: string) => void, error: (message: string) => void) {
  const [media, setMedia] = useState(initialMedia);
  useEffect(() => {
    let active = true;
    const room = new Room({ adaptiveStream: true, dynacast: true });
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
      RoomEvent.LocalTrackPublished, RoomEvent.LocalTrackUnpublished, RoomEvent.AudioPlaybackStatusChanged,
    ] as const;
    for (const event of events) room.on(event, sync);
    room.on(RoomEvent.ParticipantConnected, participant => { notice(`${participant.name || "Участник"} подключился.`); sync(); });
    room.on(RoomEvent.ParticipantDisconnected, participant => { notice(`${participant.name || "Участник"} вышел из звонка.`); sync(); });
    room.on(RoomEvent.Reconnected, () => { notice("Связь восстановлена."); sync(); });
    room.on(RoomEvent.Disconnected, reason => { notice(reason ? `Связь завершена: ${reason}.` : "Связь завершена."); sync(); });
    room.connect(session.url, session.token).then(async () => {
      try {
        await room.localParticipant.setCameraEnabled(true);
        await room.localParticipant.setMicrophoneEnabled(true);
      } catch (problem) {
        error(classroomMediaError(problem, "Камера или микрофон не подключены. Их можно включить кнопками ниже."));
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
      void room.disconnect();
    };
  }, [session.token, session.url, notice, error]);
  return media;
}

export function classroomMediaError(problem: unknown, fallback: string) {
  const name = problem instanceof Error ? problem.name : "";
  if (name === "NotAllowedError" || name === "PermissionDeniedError") {
    return "Браузер не предоставил доступ. Проверьте разрешения и повторите действие.";
  }
  if (name === "NotFoundError" || name === "DevicesNotFoundError") return "Подходящее устройство не найдено.";
  if (name === "NotReadableError" || name === "TrackStartError") return "Устройство занято или недоступно. Проверьте настройки браузера.";
  if (name === "AbortError") return "Действие отменено.";
  return fallback;
}
