export const classroomColors = [
  { value: "#163b31", name: "Графитовый" },
  { value: "#187658", name: "Зелёный" },
  { value: "#ae482c", name: "Терракотовый" },
] as const;

export const classroomNotesLimit = 6000;
export const classroomPointLimit = 240;
export const classroomStrokeLimit = 160;

export type ClassroomRole = "teacher" | "student";
export type ClassroomStroke = { id: string; author: string; color: string; points: string[] };
export type ClassroomBoardState = { strokes: ClassroomStroke[]; notes: Partial<Record<ClassroomRole, string>> };
export type ClassroomSession = { roomId: string; role: ClassroomRole; url: string; token: string };
export type ClassroomStudent = { id: string; name: string };
export type ClassroomControl = {
  teacherId: string;
  studentId: string;
  studentName: string;
  studentCanDraw: boolean;
  studentRemoved: boolean;
  status: "open" | "ended";
};

export const emptyClassroomBoard: ClassroomBoardState = { strokes: [], notes: {} };

export function isClassroomId(value: unknown): value is string {
  return typeof value === "string" && /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/.test(value);
}

export function isClassroomStroke(value: unknown): value is Omit<ClassroomStroke, "author"> {
  if (!value || typeof value !== "object") return false;
  const stroke = value as Partial<ClassroomStroke>;
  return isClassroomId(stroke.id) && classroomColors.some(color => color.value === stroke.color)
    && Array.isArray(stroke.points) && stroke.points.length >= 2 && stroke.points.length <= classroomPointLimit
    && stroke.points.every(point => typeof point === "string" && /^-?\d{1,4}\.\d,-?\d{1,4}\.\d$/.test(point));
}
