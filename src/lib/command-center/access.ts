import "server-only";
import { getFirebaseAdmin } from "../firebase-admin";
export async function preparationAccess(request: Request, studentId?: string | null) {
  const bearer = request.headers.get("authorization");
  if (!bearer?.startsWith("Bearer ")) throw new Error("401");
  const { adminAuth, adminDb } = getFirebaseAdmin();
  const user = await adminAuth.verifyIdToken(bearer.slice(7), true).catch(() => null);
  if (!user) throw new Error("401");
  const teacher = user.email?.toLowerCase() === "e.galkin07@mail.ru";
  const target = studentId || user.uid;
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(target)) throw new Error("400");
  if (target !== user.uid) {
    if (!teacher) throw new Error("403");
    const links = await adminDb.collection("teacherStudents").where("teacherId", "==", user.uid).where("studentId", "==", target).limit(1).get();
    if (links.empty || !links.docs.some(link => link.get("status") === undefined || link.get("status") === "active")) throw new Error("403");
  }
  const profile = (await adminDb.doc(`users/${target}`).get()).data();
  if (!(teacher && target === user.uid) && (profile?.role !== "student" || profile.status !== "active")) throw new Error("403");
  return { db: adminDb, user, target, teacher, profile };
}
