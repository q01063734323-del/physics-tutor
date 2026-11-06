import { NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { hashInvitationToken } from "@/lib/invitations";

export async function POST(request: Request) {
  try {
    const body = await request.json() as { token?: string; password?: string };
    if (!body.token || !body.password || body.password.length < 6) return NextResponse.json({ error: "Token and password of at least 6 characters are required" }, { status: 400 });
    const tokenHash = await hashInvitationToken(body.token);
    const snapshot = await adminDb.collection("invitations").where("tokenHash", "==", tokenHash).where("status", "==", "pending").limit(1).get();
    if (snapshot.empty) return NextResponse.json({ error: "Invitation is invalid or already used" }, { status: 400 });
    const invitation = snapshot.docs[0];
    const data = invitation.data();
    if (!data.expiresAt || Date.parse(String(data.expiresAt)) <= Date.now()) { await invitation.ref.update({ status: "expired" }); return NextResponse.json({ error: "Invitation has expired" }, { status: 400 }); }
    const user = await adminAuth.createUser({ email: data.email, password: body.password, displayName: data.displayName });
    const batch = adminDb.batch();
    batch.set(adminDb.doc(`users/${user.uid}`), { uid: user.uid, email: data.email, displayName: data.displayName, role: "student", status: "active", createdAt: new Date(), updatedAt: new Date() });
    batch.set(adminDb.collection("teacherStudents").doc(), { teacherId: data.teacherId, studentId: user.uid, studentEmail: data.email, status: "active", createdAt: new Date() });
    batch.update(invitation.ref, { status: "accepted", acceptedAt: new Date(), acceptedBy: user.uid });
    await batch.commit();
    return NextResponse.json({ uid: user.uid, email: user.email }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invitation acceptance failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
