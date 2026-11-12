import type { User } from "firebase/auth";

export async function classroomRequest<T>(user: User, body?: Record<string, unknown>, signal?: AbortSignal): Promise<T> {
  const response = await fetch("/api/classroom", {
    method: body ? "POST" : "GET",
    headers: {
      Authorization: `Bearer ${await user.getIdToken()}`,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
    signal,
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "Не удалось выполнить действие.");
  return result as T;
}
