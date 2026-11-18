import { publishedTrainerById, publishedTrainerCatalog, publishedTrainerVersion } from "@/lib/published-trainer-server";
import { checkPublishedAnswer } from "@/lib/trainer-public";

function reply(body: object, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
}

export async function GET() {
  return reply({ version: publishedTrainerVersion, questions: publishedTrainerCatalog });
}

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) return reply({ error: "Открой тренажёр на сайте Физика с Егором." }, 403);
  if (!request.headers.get("content-type")?.startsWith("application/json")) return reply({ error: "Ожидается JSON." }, 415);
  if (Number(request.headers.get("content-length")) > 8192) return reply({ error: "Слишком большой ответ." }, 413);
  const text = await request.text();
  if (text.length > 8192) return reply({ error: "Слишком большой ответ." }, 413);
  let data;
  try { data = JSON.parse(text); } catch { return reply({ error: "Не удалось прочитать ответ." }, 400); }
  if (!data || typeof data.id !== "string" || data.id.length > 150 || typeof data.input !== "string" || !data.input.trim() || data.input.length > 500) return reply({ error: "Введи ответ длиной до 500 символов." }, 400);
  const question = publishedTrainerById.get(data.id);
  if (!question) return reply({ error: "Задача не найдена." }, 404);
  if (question.version !== data.version) return reply({ error: "Задача обновилась. Обнови страницу и реши новую версию." }, 409);
  return reply(checkPublishedAnswer(question, data.input.trim()));
}
