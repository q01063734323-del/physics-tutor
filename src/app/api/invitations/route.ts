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
    const body = await request.json() as { email?: string; displayName?: string };
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const displayName = typeof body.displayName === "string" ? body.displayName.trim() : "";
    if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !displayName || displayName.length > 120) return NextResponse.json({ error: "Email and displayName are required" }, { status: 400 });
    try {
      await adminAuth.getUserByEmail(email);
      return NextResponse.json({ error: "Аккаунт с таким email уже существует" }, { status: 409 });
    } catch (error) {
      if ((error as { code?: string }).code !== "auth/user-not-found") throw error;
    }
    const token = createInvitationToken();
    const tokenHash = await hashInvitationToken(token);
    const expiresAt = invitationExpiry(7);
    const ref = await adminDb.collection("invitations").add({ teacherId: decoded.uid, email, displayName, tokenHash, status: "pending", expiresAt, createdAt: new Date() });
    const invitePath = `/invite/${token}`;
    const delivery = await deliverInvitation(email, displayName, invitePath);
    return NextResponse.json({ id: ref.id, expiresAt, invitePath, delivery }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invitation failed";
    return NextResponse.json({ error: message }, { status: message.includes("configured") ? 503 : 500 });
  }
}
