import { deliverInvitation } from "@/lib/invitation-mail";
import { NextResponse } from "next/server";
import { getFirebaseAdmin } from "@/lib/firebase-admin";
import { createInvitationToken, hashInvitationToken, invitationExpiry } from "@/lib/invitations";

export async function POST(request: Request) {
  try {
    const authorization = request.headers.get("authorization");
    if (!authorization?.startsWith("Bearer ")) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { adminAuth, adminDb } = getFirebaseAdmin();
    const decoded = await adminAuth.verifyIdToken(authorization.slice(7), true).catch(() => null);
    if (!decoded) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (decoded.email !== "e.galkin58@mail.ru") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const body = await request.json() as { invitationId?: string };
    if (typeof body.invitationId !== "string" || !body.invitationId || body.invitationId.includes("/")) return NextResponse.json({ error: "invitationId is required" }, { status: 400 });
    const ref = adminDb.doc(`invitations/${body.invitationId}`);
    const token = createInvitationToken();
    const tokenHash = await hashInvitationToken(token);
    const expiresAt = invitationExpiry(7);
    const updated = await adminDb.runTransaction(async transaction => {
      const data = (await transaction.get(ref)).data();
      if (!data || data.teacherId !== decoded.uid || !["pending", "expired"].includes(data.status)) return null;
      transaction.update(ref, { tokenHash, status: "pending", expiresAt, resentAt: new Date() });
      return { email: String(data.email), displayName: String(data.displayName) };
    });
    if (!updated) return NextResponse.json({ error: "Приглашение недоступно для повторного выпуска" }, { status: 409 });
    const invitePath = `/invite/${token}`;
    const delivery = await deliverInvitation(updated.email, updated.displayName, invitePath);
    return NextResponse.json({ id: body.invitationId, expiresAt, invitePath, delivery });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Invitation resend failed" }, { status: 500 });
  }
}
