import { NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase-admin";

export async function POST(request: Request) {
  try {
    const authorization = request.headers.get("authorization");
    if (!authorization?.startsWith("Bearer ")) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const decoded = await adminAuth.verifyIdToken(authorization.slice(7));
    if (decoded.email !== "e.galkin58@mail.ru" && decoded.teacher !== true) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const body = await request.json() as { studentId?: string; status?: "active" | "inactive" };
    if (!body.studentId || !body.status) return NextResponse.json({ error: "studentId and status are required" }, { status: 400 });
    const link = await adminDb.collection("teacherStudents").where("teacherId", "==", decoded.uid).where("studentId", "==", body.studentId).limit(1).get();
    if (link.empty) return NextResponse.json({ error: "Student is not linked to this teacher" }, { status: 403 });
    await adminDb.doc(`users/${body.studentId}`).set({ status: body.status, updatedAt: new Date() }, { merge: true });
    await adminAuth.updateUser(body.studentId, { disabled: body.status === "inactive" });
    return NextResponse.json({ studentId: body.studentId, status: body.status });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Status update failed" }, { status: 500 }); }
}
