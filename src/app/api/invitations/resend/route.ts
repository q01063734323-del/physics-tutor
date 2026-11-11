import { NextResponse } from "next/server";
import { getFirebaseAdmin } from "@/lib/firebase-admin";
import { createInvitationToken, hashInvitationToken, invitationExpiry } from "@/lib/invitations";

export async function POST(request: Request) {
  try {
    const { adminAuth, adminDb } = getFirebaseAdmin();
    const authorization = request.headers.get("authorization");
    if (!authorization?.startsWith("Bearer ")) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const decoded = await adminAuth.verifyIdToken(authorization.slice(7), true);
    if (decoded.email !== "e.galkin58@mail.ru") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const body = await request.json() as { invitationId?: string };
    if (typeof body.invitationId !== "string" || !body.invitationId || body.invitationId.includes("/")) return NextResponse.json({ error: "invitationId is required" }, { status: 400 });
    const ref = adminDb.doc(`invitations/${body.invitationId}`);
    const token = createInvitationToken();
    const tokenHash = await hashInvitationToken(token);
    const expiresAt = invitationExpiry(7);
    const updated = await adminDb.runTransaction(async transaction => {
      const data = (await transaction.get(ref)).data();
      if (!data || data.teacherId !== decoded.uid || !["pending", "expired"].includes(data.status)) return false;
      transaction.update(ref, { tokenHash, status: "pending", expiresAt, resentAt: new Date() });
      return true;
    });
    if (!updated) return NextResponse.json({ error: "Приглашение недоступно для повторного выпуска" }, { status: 409 });
    return NextResponse.json({ id: body.invitationId, expiresAt, invitePath: `/invite/${token}` });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Invitation resend failed" }, { status: 500 });
  }
}
