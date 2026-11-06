import { NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { createInvitationToken, hashInvitationToken, invitationExpiry } from "@/lib/invitations";

export async function POST(request: Request) {
  try {
    const authorization = request.headers.get("authorization");
    if (!authorization?.startsWith("Bearer ")) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const decoded = await adminAuth.verifyIdToken(authorization.slice(7));
    if (decoded.email !== "e.galkin58@mail.ru" && decoded.teacher !== true) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const body = await request.json() as { email?: string; displayName?: string };
    const email = body.email?.trim().toLowerCase();
    const displayName = body.displayName?.trim();
    if (!email || !email.includes("@") || !displayName) return NextResponse.json({ error: "Email and displayName are required" }, { status: 400 });
    const token = createInvitationToken();
    const tokenHash = await hashInvitationToken(token);
    const expiresAt = invitationExpiry(7);
    const ref = await adminDb.collection("invitations").add({ teacherId: decoded.uid, email, displayName, tokenHash, status: "pending", expiresAt, createdAt: new Date() });
    return NextResponse.json({ id: ref.id, expiresAt, invitePath: `/invite/${token}` }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invitation failed";
    return NextResponse.json({ error: message }, { status: message.includes("configured") ? 503 : 500 });
  }
}
