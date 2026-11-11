import { NextResponse } from "next/server";
import { getFirebaseAdmin } from "@/lib/firebase-admin";
import { hashInvitationToken } from "@/lib/invitations";

export async function POST(request: Request) {
  try {
    const { adminAuth, adminDb } = getFirebaseAdmin();
    const body = await request.json() as { token?: string; password?: string };
    if (typeof body.token !== "string" || !body.token || body.token.length > 256 || typeof body.password !== "string" || body.password.length < 6 || body.password.length > 128) return NextResponse.json({ error: "Token and password of at least 6 characters are required" }, { status: 400 });
    const tokenHash = await hashInvitationToken(body.token);
    const snapshot = await adminDb.collection("invitations").where("tokenHash", "==", tokenHash).where("status", "==", "pending").limit(1).get();
    if (snapshot.empty) return NextResponse.json({ error: "Invitation is invalid or already used" }, { status: 400 });
    const invitation = snapshot.docs[0];
    const data = invitation.data();
    if (!data.expiresAt || Date.parse(String(data.expiresAt)) <= Date.now()) { return NextResponse.json({ error: "Invitation has expired" }, { status: 400 }); }
    const user = await adminAuth.createUser({ email: data.email, password: body.password, displayName: data.displayName });
    try {
      await adminDb.runTransaction(async transaction => {
        const current = (await transaction.get(invitation.ref)).data();
        if (!current || current.tokenHash !== tokenHash || current.status !== "pending"
          || !(Date.parse(String(current.expiresAt)) > Date.now())) throw new Error("Invitation no longer valid");
        transaction.set(adminDb.doc(`users/${user.uid}`), { uid: user.uid, email: data.email, displayName: data.displayName, role: "student", status: "active", createdAt: new Date(), updatedAt: new Date() });
        transaction.set(adminDb.collection("teacherStudents").doc(), { teacherId: data.teacherId, studentId: user.uid, studentEmail: data.email, status: "active", createdAt: new Date() });
        transaction.update(invitation.ref, { status: "accepted", acceptedAt: new Date(), acceptedBy: user.uid });
      });
    } catch (error) {
      if (error instanceof Error && error.message === "Invitation no longer valid") {
        await adminAuth.deleteUser(user.uid);
        return NextResponse.json({ error: "Ссылка устарела или уже использована" }, { status: 409 });
      }
      throw error;
    }
    return NextResponse.json({ uid: user.uid, email: user.email }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invitation acceptance failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
