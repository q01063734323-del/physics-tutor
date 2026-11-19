export type StudioMode = "studio" | "cinema" | "free";
export type Point = { x: number; y: number };
export type StudioLayout = { mode: StudioMode; railWidth: number; cameraWidth: number; cameras: boolean; hidden: string[]; positions: Record<string, Point> };
export const defaultLayout: StudioLayout = { mode: "studio", railWidth: 248, cameraWidth: 216, cameras: true, hidden: [], positions: {} };
export const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
export function normalizeLayout(value: unknown): StudioLayout {
  const data = value && typeof value === "object" ? value as Partial<StudioLayout> : {};
  const positions: Record<string, Point> = {};
  if (data.positions && typeof data.positions === "object") for (const [id, point] of Object.entries(data.positions).slice(0, 4)) {
    if (["teacher", "student", "local", "peer"].includes(id) && point && Number.isFinite(point.x) && Number.isFinite(point.y)) positions[id] = { x: clamp(point.x, 0, 1), y: clamp(point.y, 0, 1) };
  }
  return { mode: ["studio", "cinema", "free"].includes(data.mode || "") ? data.mode! : "studio",
    railWidth: Number.isFinite(data.railWidth) ? clamp(data.railWidth!, 180, 340) : 248,
    cameraWidth: Number.isFinite(data.cameraWidth) ? clamp(data.cameraWidth!, 140, 300) : 216,
    hidden: Array.isArray(data.hidden) ? [...new Set(data.hidden.filter(key => ["teacher", "student", "local", "peer"].includes(key)))] : [],
    cameras: typeof data.cameras === "boolean" ? data.cameras : true, positions };
}
export const chatTopic = "physics-studio.chat.v1";
export const chatLimit = 1200;
export type StudioMessage = { id: string; text: string; sender: string; name: string; at: number; local: boolean };
export function readChatPacket(payload: Uint8Array): { id: string; text: string; at: number } | null {
  if (payload.byteLength > 8192) return null;
  try {
    const data = JSON.parse(new TextDecoder().decode(payload));
    if (typeof data.id !== "string" || !/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/.test(data.id) || typeof data.text !== "string" || !data.text.trim() || data.text.length > chatLimit || !Number.isFinite(data.at)) return null;
    return { id: data.id, text: data.text.trim(), at: data.at };
  } catch { return null; }
}
export type MediaPreferences = { camera: boolean; microphone: boolean; cameraId?: string; microphoneId?: string; speakerId?: string };
export const defaultMediaPreferences: MediaPreferences = { camera: false, microphone: false };
