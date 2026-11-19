"use client";
import { useState } from "react";
import { ConnectionState } from "livekit-client";
import Link from "next/link";
import { PhysicsStudio } from "./PhysicsStudio";
import { StudioPrejoin } from "./StudioPrejoin";
import { ClassroomBoard } from "./ClassroomBoard";
import type { ClassroomStroke } from "@/lib/classroom";
export function StudioPreview() {
  const [strokes, setStrokes] = useState<ClassroomStroke[]>([]);
  const [prejoin, setPrejoin] = useState(false);
  if (prejoin) return <StudioPrejoin name="Егор" lesson="Предпросмотр подготовки · без подключения к звонку" onJoin={() => setPrejoin(false)} onCancel={() => setPrejoin(false)}/>;
  return <PhysicsStudio preview media={{ room: null, state: ConnectionState.Disconnected, audioAllowed: true, participants: [] }} role="teacher" accountId="ui-preview" onLeave={() => setPrejoin(true)} board={<ClassroomBoard label="Локальная доска · без звонка" strokes={strokes} accountId="preview" canDraw canEraseAll onStroke={stroke => setStrokes(previous => [...previous, { ...stroke, author: "preview" }])} onErase={id => setStrokes(previous => previous.filter(stroke => stroke.id !== id))} onUndo={() => setStrokes(previous => previous.slice(0, -1))}/>} resources={<><p>Это безопасный предпросмотр интерфейса. Урок не создан, данные Firebase и LiveKit не используются.</p><button type="button" onClick={() => setPrejoin(true)}>Подготовка к звонку</button><Link href="/classroom">Вернуться к настоящим урокам</Link></>}/>;
}
