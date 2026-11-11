import "server-only";

export async function deliverInvitation(email: string, displayName: string, invitePath: string) {
  const { INVITATION_MAIL_WEBHOOK, INVITATION_MAIL_TOKEN, INVITATION_PUBLIC_ORIGIN } = process.env;
  if (!INVITATION_MAIL_WEBHOOK || !INVITATION_MAIL_TOKEN || !INVITATION_PUBLIC_ORIGIN) return "unconfigured";
  try {
    const endpoint = new URL(INVITATION_MAIL_WEBHOOK);
    const origin = new URL(INVITATION_PUBLIC_ORIGIN);
    if (endpoint.protocol !== "https:" || origin.protocol !== "https:") return "failed";
    const response = await fetch(endpoint, {
      method: "POST",
      redirect: "error",
      signal: AbortSignal.timeout(7000),
      headers: { Authorization: `Bearer ${INVITATION_MAIL_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({ email, displayName, invitationUrl: new URL(invitePath, origin).href }),
    });
    return response.ok ? "accepted" : "failed";
  } catch {
    return "failed";
  }
}
