import { NextResponse } from "next/server";
import { getFirebaseAdmin } from "@/lib/firebase-admin";

export async function POST(request: Request) {
  try {
    const { adminAuth, adminDb } = getFirebaseAdmin();
    const authorization = request.headers.get("authorization");
    if (!authorization?.startsWith("Bearer ")) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const decoded = await adminAuth.verifyIdToken(authorization.slice(7), true);
    if (decoded.email !== "e.galkin58@mail.ru") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const body = await request.json() as { studentId?: string; status?: "active" | "inactive" };
    if (typeof body.studentId !== "string" || !body.studentId || body.studentId.includes("/") || !["active", "inactive"].includes(body.status ?? "")) return NextResponse.json({ error: "studentId and status are required" }, { status: 400 });
    const link = await adminDb.collection("teacherStudents").where("teacherId", "==", decoded.uid).where("studentId", "==", body.studentId).limit(1).get();
    if (link.empty) return NextResponse.json({ error: "Student is not linked to this teacher" }, { status: 403 });
    const ref = adminDb.doc(`users/${body.studentId}`);
    const profile = await ref.get();
    if (profile.data()?.role !== "student") return NextResponse.json({ error: "Профиль ученика не найден" }, { status: 404 });
    if (body.status === "inactive") await ref.update({ status: "inactive", updatedAt: new Date() });
    await adminAuth.updateUser(body.studentId, { disabled: body.status === "inactive" });
    if (body.status === "active") await ref.update({ status: "active", updatedAt: new Date() });
    return NextResponse.json({ studentId: body.studentId, status: body.status });
  } catch { return NextResponse.json({ error: "Не удалось изменить статус ученика" }, { status: 500 }); }
}
