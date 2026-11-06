import { NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { createInvitationToken, hashInvitationToken, invitationExpiry } from "@/lib/invitations";

export async function POST(request: Request) {
  try {
    const authorization = request.headers.get("authorization");
    if (!authorization?.startsWith("Bearer ")) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const decoded = await adminAuth.verifyIdToken(authorization.slice(7));
    if (decoded.email !== "e.galkin58@mail.ru" && decoded.teacher !== true) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const body = await request.json() as { invitationId?: string };
    if (!body.invitationId) return NextResponse.json({ error: "invitationId is required" }, { status: 400 });
    const ref = adminDb.doc(`invitations/${body.invitationId}`);
    const snapshot = await ref.get();
    if (!snapshot.exists || snapshot.data()?.teacherId !== decoded.uid) return NextResponse.json({ error: "Invitation not found" }, { status: 404 });
    const token = createInvitationToken();
    const expiresAt = invitationExpiry(7);
    await ref.update({ tokenHash: await hashInvitationToken(token), status: "pending", expiresAt, resentAt: new Date() });
    return NextResponse.json({ id: body.invitationId, expiresAt, invitePath: `/invite/${token}` });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Invitation resend failed" }, { status: 500 });
  }
}
