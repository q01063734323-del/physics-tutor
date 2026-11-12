import { randomUUID } from "node:crypto";
import { AccessToken, RoomConfiguration, RoomServiceClient, TrackSource } from "livekit-server-sdk";
import type { Firestore, Timestamp } from "firebase-admin/firestore";
import { getFirebaseAdmin } from "@/lib/firebase-admin";
import {
  classroomNotesLimit, classroomStrokeLimit, emptyClassroomBoard, isClassroomId, isClassroomStroke,
  type ClassroomBoardState, type ClassroomControl, type ClassroomRole,
} from "@/lib/classroom";

const teacherEmail = "e.galkin58@mail.ru";
const roomOptions = { maxParticipants: 2, emptyTimeout: 300, departureTimeout: 120 };
const lessonDuration = 4 * 60 * 60 * 1000;

class ClassroomError extends Error {
  constructor(message: string, readonly status: number) { super(message); }
}

type Account = { id: string; role: ClassroomRole; name: string; db: Firestore };
type Lesson = ClassroomControl & { expiresAt: Timestamp };

function reply(body: object, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

async function accountFor(request: Request): Promise<Account> {
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) throw new ClassroomError("Войдите в Physics Tutor.", 401);
  const { adminAuth, adminDb } = getFirebaseAdmin();
  const user = await adminAuth.verifyIdToken(authorization.slice(7), true).catch(() => null);
  if (!user) throw new ClassroomError("Войдите в Physics Tutor ещё раз.", 401);
  if (user.email?.toLowerCase() === teacherEmail) {
    return { id: user.uid, role: "teacher", name: "Егор", db: adminDb };
  }
  const profile = (await adminDb.doc(`users/${user.uid}`).get()).data();
  if (profile?.role !== "student" || profile.status !== "active") {
    throw new ClassroomError("Доступ к классу не подтверждён.", 403);
  }
  const name = typeof profile.displayName === "string" ? profile.displayName.trim().slice(0, 120) : "";
  return { id: user.uid, role: "student", name: name || "Ученик", db: adminDb };
}

function liveKit() {
  const url = process.env.LIVEKIT_URL;
  const key = process.env.LIVEKIT_API_KEY;
  const secret = process.env.LIVEKIT_API_SECRET;
  if (!url || !key || !secret) throw new ClassroomError("Видеосвязь ещё не настроена на сервере.", 503);
  const api = new URL(url);
  if (api.protocol === "wss:") api.protocol = "https:";
  else if (api.protocol === "ws:" && ["127.0.0.1", "localhost"].includes(api.hostname)) api.protocol = "http:";
  else throw new ClassroomError("Некорректный адрес LiveKit.", 503);
  return { url, key, secret, rooms: new RoomServiceClient(api.origin, key, secret) };
}

function lessonFor(data: FirebaseFirestore.DocumentData | undefined, account: Account): Lesson {
  const lesson = data as Lesson | undefined;
  const member = account.role === "teacher" ? lesson?.teacherId === account.id : lesson?.studentId === account.id;
  if (!lesson || !member || (account.role === "student" && lesson.studentRemoved)) {
    throw new ClassroomError("Приглашение недоступно для вашего аккаунта.", 403);
  }
  if (lesson.status !== "open" || lesson.expiresAt.toMillis() <= Date.now()) {
    throw new ClassroomError("Урок уже завершён или срок приглашения истёк.", 410);
  }
  return lesson;
}

async function getStudents(account: Account) {
  if (account.role !== "teacher") return [];
  const links = await account.db.collection("teacherStudents").where("teacherId", "==", account.id).get();
  const ids = [...new Set(links.docs.map(link => link.get("studentId")))]
    .filter((id): id is string => typeof id === "string" && id.length > 0 && !id.includes("/"));
  if (!ids.length) return [];
  const profiles = await account.db.getAll(...ids.map(id => account.db.doc(`users/${id}`)));
  return profiles.flatMap(profile => {
    const data = profile.data();
    return data?.role === "student" && data.status === "active"
      ? [{ id: profile.id, name: String(data.displayName || data.email || "Ученик").slice(0, 120) }]
      : [];
  }).sort((a, b) => a.name.localeCompare(b.name, "ru"));
}

async function issueToken(account: Account, roomId: string, config: ReturnType<typeof liveKit>) {
  const token = new AccessToken(config.key, config.secret, {
    identity: account.id, name: account.name, ttl: "5h", metadata: JSON.stringify({ role: account.role }),
  });
  token.roomConfig = new RoomConfiguration(roomOptions);
  token.addGrant({
    room: `pt-${roomId}`, roomJoin: true, canSubscribe: true, canPublish: true,
    canPublishData: false, canUpdateOwnMetadata: false,
    canPublishSources: account.role === "teacher"
      ? [TrackSource.CAMERA, TrackSource.MICROPHONE, TrackSource.SCREEN_SHARE]
      : [TrackSource.CAMERA, TrackSource.MICROPHONE],
  });
  return reply({ roomId, role: account.role, url: config.url, token: await token.toJwt() });
}

async function createLesson(account: Account, studentId: unknown) {
  if (account.role !== "teacher") throw new ClassroomError("Создать урок может преподаватель.", 403);
  if (typeof studentId !== "string" || !studentId || studentId.length > 128 || studentId.includes("/")) {
    throw new ClassroomError("Выберите ученика.", 400);
  }
  const config = liveKit();
  const [link, profile] = await Promise.all([
    account.db.collection("teacherStudents").where("teacherId", "==", account.id).where("studentId", "==", studentId).limit(1).get(),
    account.db.doc(`users/${studentId}`).get(),
  ]);
  const student = profile.data();
  if (link.empty || student?.role !== "student" || student.status !== "active") {
    throw new ClassroomError("Можно пригласить только своего активного ученика.", 403);
  }
  const roomId = randomUUID();
  const ref = account.db.doc(`classroomRooms/${roomId}`);
  const expiresAt = new Date(Date.now() + lessonDuration);
  const batch = account.db.batch();
  batch.create(ref, {
    teacherId: account.id, studentId, studentName: String(student.displayName || student.email || "Ученик").slice(0, 120),
    studentCanDraw: true, studentRemoved: false, status: "open", expiresAt,
  });
  batch.create(ref.collection("board").doc("state"), { ...emptyClassroomBoard, expiresAt });
  await batch.commit();
  return issueToken(account, roomId, config);
}

async function mutateBoard(account: Account, roomId: string, input: Record<string, unknown>) {
  const ref = account.db.doc(`classroomRooms/${roomId}`);
  const board = ref.collection("board").doc("state");
  await account.db.runTransaction(async transaction => {
    const [lessonDoc, boardDoc] = await Promise.all([transaction.get(ref), transaction.get(board)]);
    const lesson = lessonFor(lessonDoc.data(), account);
    const state = (boardDoc.data() ?? emptyClassroomBoard) as ClassroomBoardState;
    if (input.action === "notes") {
      if (typeof input.text !== "string" || input.text.length > classroomNotesLimit) {
        throw new ClassroomError("Заметка слишком длинная.", 400);
      }
      transaction.update(board, { notes: { ...state.notes, [account.role]: input.text } });
      return;
    }
    if (account.role === "student" && !lesson.studentCanDraw) {
      throw new ClassroomError("Преподаватель приостановил рисование.", 403);
    }
    if (input.action === "stroke") {
      if (!isClassroomStroke(input.stroke)) throw new ClassroomError("Некорректный штрих.", 400);
      if (state.strokes.some(stroke => stroke.id === (input.stroke as { id: string }).id)) return;
      if (state.strokes.length >= classroomStrokeLimit) {
        throw new ClassroomError("Доска заполнена. Сотрите лишние штрихи.", 409);
      }
      const { id, color, points } = input.stroke;
      transaction.update(board, { strokes: [...state.strokes, { id, color, points, author: account.id }] });
      return;
    }
    const target = input.action === "undo"
      ? state.strokes.findLast(stroke => stroke.author === account.id)
      : state.strokes.find(stroke => stroke.id === input.strokeId);
    if (!target) return;
    if (target.author !== account.id && account.role !== "teacher") {
      throw new ClassroomError("Можно стирать только свои штрихи.", 403);
    }
    transaction.update(board, { strokes: state.strokes.filter(stroke => stroke.id !== target.id) });
  });
  return reply({ ok: true });
}

async function moderate(account: Account, roomId: string, input: Record<string, unknown>) {
  if (account.role !== "teacher") throw new ClassroomError("Управлять уроком может преподаватель.", 403);
  const ref = account.db.doc(`classroomRooms/${roomId}`);
  const { rooms } = liveKit();
  const mediaRoom = `pt-${roomId}`;
  if (input.action === "drawing" && typeof input.enabled !== "boolean") {
    throw new ClassroomError("Укажите доступ к рисованию.", 400);
  }
  const lesson = await account.db.runTransaction(async transaction => {
    const data = (await transaction.get(ref)).data();
    if (data?.teacherId !== account.id) throw new ClassroomError("Нет доступа к уроку.", 403);
    // Ending and removal can be retried when the media provider is temporarily unavailable.
    const lesson = input.action === "end" && data.status === "ended" ? data as Lesson : lessonFor(data, account);
    if (input.action === "drawing") transaction.update(ref, { studentCanDraw: input.enabled });
    if (input.action === "remove") transaction.update(ref, { studentRemoved: true });
    if (input.action === "end") transaction.update(ref, { status: "ended" });
    return lesson;
  });
  if (input.action === "drawing") return reply({ ok: true });
  if (!(await rooms.listRooms([mediaRoom])).some(room => room.name === mediaRoom)) return reply({ ok: true });
  if (input.action === "end") await rooms.deleteRoom(mediaRoom);
  else {
    const participant = (await rooms.listParticipants(mediaRoom)).find(user => user.identity === lesson.studentId);
    if (participant && input.action === "remove") await rooms.removeParticipant(mediaRoom, participant.identity);
    if (participant && input.action === "mute") {
      const track = participant.tracks.find(track => track.source === TrackSource.MICROPHONE);
      if (track && !track.muted) await rooms.mutePublishedTrack(mediaRoom, participant.identity, track.sid, true);
    }
  }
  return reply({ ok: true });
}

async function bodyFor(request: Request): Promise<Record<string, unknown>> {
  const reader = request.body?.getReader();
  if (!reader) throw new ClassroomError("Нет данных запроса.", 400);
  let size = 0;
  let raw = "";
  const decoder = new TextDecoder();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > 32768) {
      await reader.cancel();
      throw new ClassroomError("Запрос слишком большой.", 413);
    }
    raw += decoder.decode(value, { stream: true });
  }
  try {
    const body = JSON.parse(raw + decoder.decode());
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error();
    return body;
  } catch { throw new ClassroomError("Некорректный запрос.", 400); }
}

function errorResponse(error: unknown) {
  if (error instanceof ClassroomError) return reply({ error: error.message }, error.status);
  return reply({ error: "Сервис урока временно недоступен. Попробуйте ещё раз." }, 502);
}

export async function GET(request: Request) {
  try {
    const account = await accountFor(request);
    return reply({ role: account.role, students: await getStudents(account) });
  } catch (error) { return errorResponse(error); }
}

export async function POST(request: Request) {
  try {
    if (request.headers.get("sec-fetch-site") === "cross-site") throw new ClassroomError("Запрос отклонён.", 403);
    const account = await accountFor(request);
    const input = await bodyFor(request);
    if (input.action === "create") return await createLesson(account, input.studentId);
    if (!isClassroomId(input.roomId)) throw new ClassroomError("Проверьте ссылку или код урока.", 400);
    if (input.action === "join") {
      const snapshot = await account.db.doc(`classroomRooms/${input.roomId}`).get();
      lessonFor(snapshot.data(), account);
      return await issueToken(account, input.roomId, liveKit());
    }
    if (["stroke", "erase", "undo", "notes"].includes(String(input.action))) {
      return await mutateBoard(account, input.roomId, input);
    }
    if (["drawing", "mute", "remove", "end"].includes(String(input.action))) {
      return await moderate(account, input.roomId, input);
    }
    throw new ClassroomError("Неизвестное действие.", 400);
  } catch (error) { return errorResponse(error); }
}
