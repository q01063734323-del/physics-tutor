import { createHash, randomBytes, randomUUID } from "node:crypto";
import { AccessToken, RoomConfiguration, RoomServiceClient, TrackSource } from "livekit-server-sdk";
import { getFirebaseAdmin } from "@/lib/firebase-admin";
import {
  classroomNotesLimit, classroomStrokeLimit, emptyClassroomBoard, isClassroomId, isClassroomStroke,
  type ClassroomBoardState, type ClassroomRole,
} from "@/lib/classroom";

import { createRoomCreationLimit } from "@/lib/studio/creation-limit";
const allowCreate = createRoomCreationLimit();

const duration = 4 * 60 * 60 * 1000;
const roomOptions = { maxParticipants: 2, emptyTimeout: 300, departureTimeout: 120 };
type DemoLesson = {
  teacherHash: string;
  studentHash: string;
  expiresAt: number;
  status: "open" | "ended";
  board: ClassroomBoardState;
};

class DemoError extends Error {
  constructor(message: string, readonly status: number) { super(message); }
}

function response(body: object, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" } });
}

function fingerprint(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function config() {
  const url = process.env.LIVEKIT_URL;
  const key = process.env.LIVEKIT_API_KEY;
  const secret = process.env.LIVEKIT_API_SECRET;
  if (!url || !key || !secret) throw new DemoError("Видеосвязь ещё не настроена на сервере.", 503);
  const address = new URL(url);
  if (address.protocol !== "wss:") throw new DemoError("Проверьте адрес LiveKit на сервере.", 503);
  address.protocol = "https:";
  return { url, key, secret, rooms: new RoomServiceClient(address.origin, key, secret) };
}

function roleFor(lesson: DemoLesson | undefined, access: string): ClassroomRole {
  if (!lesson || !/^[a-f0-9]{64}$/.test(access)) throw new DemoError("Ссылка на урок недействительна.", 403);
  const hash = fingerprint(access);
  const role = hash === lesson.teacherHash ? "teacher" : hash === lesson.studentHash ? "student" : null;
  if (!role) throw new DemoError("Нет доступа к этому уроку.", 403);
  if (lesson.status !== "open" || lesson.expiresAt <= Date.now()) throw new DemoError("Урок завершён. Попросите преподавателя создать новый.", 410);
  return role;
}

async function session(roomId: string, role: ClassroomRole, expiresAt: number) {
  const provider = config();
  const token = new AccessToken(provider.key, provider.secret, {
    identity: `guest-${role}`, name: role === "teacher" ? "Преподаватель" : "Ученик",
    ttl: Math.max(1, Math.floor((expiresAt - Date.now()) / 1000)),
    metadata: JSON.stringify({ role, demo: true }),
  });
  token.roomConfig = new RoomConfiguration(roomOptions);
  token.addGrant({
    room: `pt-guest-${roomId}`, roomJoin: true, canSubscribe: true, canPublish: true,
    canPublishData: true, canUpdateOwnMetadata: false,
    canPublishSources: role === "teacher" ? [TrackSource.CAMERA, TrackSource.MICROPHONE, TrackSource.SCREEN_SHARE] : [TrackSource.CAMERA, TrackSource.MICROPHONE],
  });
  return { roomId, role, url: provider.url, token: await token.toJwt(), expiresAt };
}

export async function POST(request: Request) {
  try {
    if (process.env.NEXT_PUBLIC_ENABLE_DEMO !== "true") throw new DemoError("Гостевые уроки отключены.", 404);
    const origin = request.headers.get("origin");
    const host = request.headers.get("x-forwarded-host")?.split(",")[0].trim()
      || request.headers.get("host") || new URL(request.url).host;
    if (request.headers.get("sec-fetch-site") === "cross-site" || (origin && new URL(origin).host !== host)) {
      throw new DemoError("Запрос отклонён.", 403);
    }
    const raw = await request.text();
    if (raw.length > 32768) throw new DemoError("Запрос слишком большой.", 413);
    let input: Record<string, unknown>;
    try {
      input = JSON.parse(raw);
      if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error();
    } catch { throw new DemoError("Некорректный запрос.", 400); }
    const { adminDb } = getFirebaseAdmin();
    if (input.action === "create") {
      // Hash the proxy-provided address for a short-lived, in-memory burst guard.
      const address = (request.headers.get("x-forwarded-for")?.split(",").at(-1)?.trim() || "local").slice(0, 200);
      if (!allowCreate(fingerprint(address))) throw new DemoError("Слишком много новых уроков. Используйте открытую комнату или подождите несколько минут.", 429);
      const provider = config();
      const roomId = randomUUID();
      await provider.rooms.createRoom({ name: `pt-guest-${roomId}`, ...roomOptions });
      const access = randomBytes(32).toString("hex");
      const guestAccess = randomBytes(32).toString("hex");
      const expiresAt = Date.now() + duration;
      await adminDb.doc(`guestClassrooms/${roomId}`).create({
        teacherHash: fingerprint(access), studentHash: fingerprint(guestAccess), expiresAt,
        status: "open", board: emptyClassroomBoard,
      });
      return response({ ...await session(roomId, "teacher", expiresAt), access, guestAccess });
    }
    if (!isClassroomId(input.roomId)) throw new DemoError("Проверьте ссылку на урок.", 400);
    const roomId = input.roomId;
    const access = request.headers.get("authorization")?.replace(/^Bearer /, "") ?? "";
    const ref = adminDb.doc(`guestClassrooms/${roomId}`);
    const lesson = (await ref.get()).data() as DemoLesson | undefined;
    const role = roleFor(lesson, access);
    if (!lesson) throw new DemoError("Урок не найден.", 404);
    if (input.action === "join") return response(await session(roomId, role, lesson.expiresAt));
    if (input.action === "state") return response({ board: lesson.board, status: lesson.status });
    if (input.action === "end") {
      if (role !== "teacher") throw new DemoError("Завершить урок может преподаватель.", 403);
      await ref.update({ status: "ended" });
      await config().rooms.deleteRoom(`pt-guest-${roomId}`);
      return response({ ok: true });
    }
    if (!["stroke", "erase", "undo", "notes"].includes(String(input.action))) throw new DemoError("Неизвестное действие.", 400);
    await adminDb.runTransaction(async transaction => {
      const current = (await transaction.get(ref)).data() as DemoLesson | undefined;
      roleFor(current, access);
      if (!current) throw new DemoError("Урок не найден.", 404);
      const board = current.board;
      if (input.action === "notes") {
        if (typeof input.text !== "string" || input.text.length > classroomNotesLimit) throw new DemoError("Заметка слишком длинная.", 400);
        transaction.update(ref, { "board.notes": { ...board.notes, [role]: input.text } });
        return;
      }
      if (input.action === "stroke") {
        if (!isClassroomStroke(input.stroke)) throw new DemoError("Некорректный штрих.", 400);
        const incoming = input.stroke;
        if (board.strokes.some(stroke => stroke.id === incoming.id)) return;
        if (board.strokes.length >= classroomStrokeLimit) throw new DemoError("Доска заполнена. Сотрите лишние штрихи.", 409);
        const { id, color, points } = input.stroke;
        transaction.update(ref, { "board.strokes": [...board.strokes, { id, color, points, author: role }] });
        return;
      }
      const target = input.action === "undo"
        ? board.strokes.findLast(stroke => stroke.author === role)
        : board.strokes.find(stroke => stroke.id === input.strokeId);
      if (target && target.author !== role && role !== "teacher") throw new DemoError("Можно стирать только свои штрихи.", 403);
      if (target) transaction.update(ref, { "board.strokes": board.strokes.filter(stroke => stroke.id !== target.id) });
    });
    return response({ ok: true });
  } catch (error) {
    if (error instanceof DemoError) return response({ error: error.message }, error.status);
    console.error("Guest classroom provider error", error instanceof Error ? error.message : "unknown");
    return response({ error: "Не удалось открыть урок. Проверьте подключение и повторите попытку." }, 502);
  }
}
