import { FieldValue } from "firebase-admin/firestore";
import { getFirebaseAdmin } from "@/lib/firebase-admin";
import { feedbackTopics } from "@/lib/royale/beta-feedback";
import { trainerOriginAllowed } from "@/lib/trainer-public";

let windowEnd = 0;
let requests = 0;

const reply = (status: number) => new Response(null, {
  status, headers: { "Cache-Control": "no-store" },
});

export async function POST(request: Request) {
  if (process.env.NEXT_PUBLIC_ROYALE_BETA === "false") return reply(404);
  const origin = request.headers.get("origin");
  const publicUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://physics-tutor-6ytz.onrender.com";
  if (!origin || request.headers.get("sec-fetch-site") === "cross-site" ||
      !trainerOriginAllowed(origin, request.url, publicUrl)) return reply(403);
  if (!request.headers.get("content-type")?.startsWith("application/json")) return reply(415);
  const maxBytes = 128;
  if (Number(request.headers.get("content-length")) > maxBytes) return reply(413);
  const reader = request.body?.getReader();
  if (!reader) return reply(400);

  const decoder = new TextDecoder();
  let bytes = 0;
  let body = "";
  let input;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > maxBytes) {
        await reader.cancel().catch(() => undefined);
        return reply(413);
      }
      body += decoder.decode(value, { stream: true });
    }
    input = JSON.parse(body + decoder.decode());
  } catch {
    return reply(400);
  } finally {
    reader.releaseLock();
  }
  if (!input || Object.keys(input).length !== 2 || typeof input.topic !== "string" ||
      !Object.hasOwn(feedbackTopics, input.topic) || !Number.isInteger(input.rating) ||
      input.rating < 1 || input.rating > 5) return reply(400);

  const now = Date.now();
  if (now >= windowEnd) {
    windowEnd = now + 60_000;
    requests = 0;
  }
  if (++requests > 30) return reply(429);

  try {
    const { adminDb } = getFirebaseAdmin();
    const day = new Date(now).toISOString().slice(0, 10);
    const totals = adminDb.doc("royaleBetaFeedback/" + day);
    const field = input.topic + "_" + input.rating;
    const accepted = await adminDb.runTransaction(async transaction => {
      const snapshot = await transaction.get(totals);
      if ((snapshot.get("total") ?? 0) >= 300) return false;
      transaction.set(totals, { total: FieldValue.increment(1), [field]: FieldValue.increment(1) }, { merge: true });
      return true;
    });
    return reply(accepted ? 204 : 429);
  } catch {
    return reply(503);
  }
}
