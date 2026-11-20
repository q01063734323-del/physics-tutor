import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";
import { getFirebaseAdmin } from "../firebase-admin";
import { isClassroomId } from "../classroom";
import { isLibraryId } from "./model";
export class LibraryError extends Error { constructor(message:string,readonly status=400){super(message);} }
export async function libraryActor(request:Request) {
  if(!request.headers.get("x-classroom-guest") && !request.headers.get("authorization")?.startsWith("Bearer "))throw new LibraryError("Войдите в аккаунт.",401);
  const {adminAuth,adminDb:db}=getFirebaseAdmin();
  const roomId=request.headers.get("x-classroom-room");
  const guest=request.headers.get("x-classroom-guest");
  if (guest) {
    if(process.env.NEXT_PUBLIC_ENABLE_DEMO!=="true" || !isClassroomId(roomId) || !/^[a-f0-9]{64}$/.test(guest))throw new LibraryError("Приглашение недоступно.",403);
    const lesson=(await db.doc(`guestClassrooms/${roomId}`).get()).data();
    if(!lesson || lesson.status!=="open" || lesson.expiresAt<=Date.now())throw new LibraryError("Гостевой урок завершён.",410);
    const hash=createHash("sha256").update(guest).digest("hex");
    const same=(stored:unknown)=>typeof stored==="string" && stored.length===hash.length && timingSafeEqual(Buffer.from(stored),Buffer.from(hash));
    const teacher=same(lesson.teacherHash);if(!teacher && !same(lesson.studentHash))throw new LibraryError("Нет доступа к уроку.",403);
    return {db,id:`guest-${roomId}-${teacher?"teacher":"student"}`,ownerId:`guest-${roomId}-teacher`,teacher,roomId,guest:true,studentId:`guest-${roomId}-student`,expiresAt:Number(lesson.expiresAt)};
  }
  const bearer=request.headers.get("authorization");if(!bearer?.startsWith("Bearer "))throw new LibraryError("Войдите в аккаунт.",401);
  const user=await adminAuth.verifyIdToken(bearer.slice(7),true).catch(()=>null);if(!user)throw new LibraryError("Войдите ещё раз.",401);
  const teacher=user.email?.toLowerCase()==="e.galkin07@mail.ru";
  if(!teacher){const profile=(await db.doc(`users/${user.uid}`).get()).data();if(profile?.role!=="student" || profile.status!=="active")throw new LibraryError("Доступ не подтверждён.",403);}
  let ownerId=user.uid,studentId=user.uid;
  if(roomId){
    if(!isClassroomId(roomId))throw new LibraryError("Некорректный урок.");
    const lesson=(await db.doc(`classroomRooms/${roomId}`).get()).data();
    if(!lesson || (teacher?lesson.teacherId!==user.uid:lesson.studentId!==user.uid || lesson.studentRemoved))throw new LibraryError("Нет доступа к уроку.",403);
    if(lesson.status!=="open" || lesson.expiresAt.toMillis()<=Date.now())throw new LibraryError("Урок завершён.",410);
    ownerId=lesson.teacherId;studentId=lesson.studentId;
  }
  return {db,id:user.uid,teacher,ownerId,roomId,guest:false,studentId,expiresAt:0};
}
export type LibraryActor=Awaited<ReturnType<typeof libraryActor>>;
export function requireTeacher(actor:LibraryActor){if(!actor.teacher)throw new LibraryError("Действие доступно преподавателю.",403);}
export async function linkedStudent(actor:LibraryActor,id:unknown){
  requireTeacher(actor);if(actor.guest || !isLibraryId(id))throw new LibraryError("Выберите своего ученика.",403);
  const [links,profile]=await Promise.all([actor.db.collection("teacherStudents").where("teacherId","==",actor.id).where("studentId","==",id).get(),actor.db.doc(`users/${id}`).get()]);
  if(!links.docs.some(link=>link.get("status")===undefined || link.get("status")==="active") || profile.get("role")!=="student" || profile.get("status")!=="active")throw new LibraryError("Ученик недоступен.",403);
  return id;
}
export const grantId=(documentId:string,studentId:string)=>createHash("sha256").update(`${documentId}:${studentId}`).digest("hex");
