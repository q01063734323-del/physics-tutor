export type GraphKind = "x" | "v" | "a";
export type KinematicPoint = { t: number; value: number };
export type KinematicInitials = { x0: number; v0: number };
export type Segment = { from: KinematicPoint; to: KinematicPoint; slope: number };

export const graphLabels: Record<GraphKind, { title: string; axis: string; unit: string }> = {
  x: { title: "Координата x(t)", axis: "x", unit: "м" },
  v: { title: "Скорость v(t)", axis: "v", unit: "м/с" },
  a: { title: "Ускорение a(t)", axis: "a", unit: "м/с²" },
};

export const defaultKinematicPoints: KinematicPoint[] = [
  { t: 0, value: 0 }, { t: 2, value: 4 }, { t: 4, value: 4 }, { t: 6, value: 0 },
];

export function normalizePoints(points: KinematicPoint[]): KinematicPoint[] {
  const clean = points.filter(point => Number.isFinite(point.t) && Number.isFinite(point.value))
    .map(point => ({ t: Number(point.t.toFixed(2)), value: Number(point.value.toFixed(2)) }))
    .sort((a, b) => a.t - b.t);
  const unique: KinematicPoint[] = [];
  for (const point of clean) {
    if (unique.at(-1)?.t === point.t) unique[unique.length - 1] = point;
    else unique.push(point);
  }
  return unique;
}

export function validatePoints(points: KinematicPoint[]) {
  const normalized = normalizePoints(points);
  const errors: string[] = [];
  if (normalized.length < 2) errors.push("Нужно минимум две точки.");
  if (normalized.some(point => point.t < 0)) errors.push("Время не может быть отрицательным.");
  if (normalized.some((point, index) => index > 0 && point.t <= normalized[index - 1].t)) errors.push("Время точек должно возрастать.");
  return { valid: errors.length === 0, errors };
}

export function segments(points: KinematicPoint[]): Segment[] {
  const normalized = normalizePoints(points);
  return normalized.slice(0, -1).flatMap((from, index) => {
    const to = normalized[index + 1];
    const duration = to.t - from.t;
    return duration > 0 ? [{ from, to, slope: (to.value - from.value) / duration }] : [];
  });
}

export function derivative(points: KinematicPoint[]): KinematicPoint[] {
  const normalized = normalizePoints(points);
  if (normalized.length < 2) return [];
  const parts = segments(normalized);
  return normalized.map((point, index) => {
    if (index === 0) return { t: point.t, value: parts[0].slope };
    if (index === normalized.length - 1) return { t: point.t, value: parts.at(-1)?.slope ?? 0 };
    return { t: point.t, value: (parts[index - 1].slope + parts[index].slope) / 2 };
  });
}

export function integrate(points: KinematicPoint[], initial: number): KinematicPoint[] {
  const normalized = normalizePoints(points);
  if (!normalized.length) return [];
  const result = [{ t: normalized[0].t, value: initial }];
  for (let index = 1; index < normalized.length; index += 1) {
    const previous = normalized[index - 1];
    const current = normalized[index];
    const area = ((previous.value + current.value) / 2) * (current.t - previous.t);
    result.push({ t: current.t, value: result[index - 1].value + area });
  }
  return result;
}

export function deriveAll(source: GraphKind, points: KinematicPoint[], initials: KinematicInitials): Record<GraphKind, KinematicPoint[]> {
  const normalized = normalizePoints(points);
  if (source === "x") {
    const velocity = derivative(normalized);
    return { x: normalized, v: velocity, a: derivative(velocity) };
  }
  if (source === "v") return { x: integrate(normalized, initials.x0), v: normalized, a: derivative(normalized) };
  const velocity = integrate(normalized, initials.v0);
  return { x: integrate(velocity, initials.x0), v: velocity, a: normalized };
}

export function valueAt(points: KinematicPoint[], time: number): number | undefined {
  const normalized = normalizePoints(points);
  if (!normalized.length || time < normalized[0].t || time > normalized.at(-1)!.t) return undefined;
  if (time === normalized.at(-1)!.t) return normalized.at(-1)!.value;
  const part = segments(normalized).find(segment => time >= segment.from.t && time <= segment.to.t);
  return part ? part.from.value + part.slope * (time - part.from.t) : undefined;
}

export function displacement(velocity: KinematicPoint[]): number {
  return integrate(velocity, 0).at(-1)?.value ?? 0;
}

export function pathLength(velocity: KinematicPoint[]): number {
  return segments(velocity).reduce((sum, segment) => sum + ((Math.abs(segment.from.value) + Math.abs(segment.to.value)) / 2) * (segment.to.t - segment.from.t), 0);
}

export function stoppingTimes(velocity: KinematicPoint[]): number[] {
  return segments(velocity).flatMap(segment => {
    if (segment.from.value === 0) return [segment.from.t];
    if (segment.from.value * segment.to.value < 0 && segment.slope !== 0) return [segment.from.t - segment.from.value / segment.slope];
    return segment.to.value === 0 ? [segment.to.t] : [];
  });
}

export function directionChanges(velocity: KinematicPoint[]): number[] {
  return segments(velocity).flatMap((segment, index, all) => {
    const next = all[index + 1];
    return next && segment.slope !== 0 && next.slope !== 0 && segment.slope * next.slope < 0 ? [segment.to.t] : [];
  });
}

export function compareSeries(actual: KinematicPoint[], expected: KinematicPoint[], tolerance = 0.15) {
  const errors = expected.flatMap((point, index) => {
    const candidate = actual[index];
    return candidate && Math.abs(candidate.t - point.t) <= tolerance && Math.abs(candidate.value - point.value) <= tolerance
      ? [] : [{ index, time: point.t, expected: point.value, actual: candidate?.value }];
  });
  return { correct: errors.length === 0, correctCount: expected.length - errors.length, total: expected.length, errors };
}

export type EgeTask = { id: string; title: string; prompt: string; topic: string; answer: number; unit: string; explanation: string };

const taskFactories: Array<(seed: number) => EgeTask> = [
  seed => ({ id: "speed-" + seed, title: "Скорость по графику координаты", prompt: "Тело переместилось из x = 2 м в x = 14 м за 4 с. Найдите скорость движения.", answer: 3, unit: "м/с", topic: "Скорость", explanation: "v = Δx/Δt = (14 − 2)/4 = 3 м/с." }),
  seed => ({ id: "shift-" + seed, title: "Перемещение по участкам", prompt: "Тело прошло 18 м вправо, затем 6 м влево. Найдите перемещение.", answer: 12, unit: "м", topic: "Перемещение", explanation: "Δx = 18 − 6 = 12 м." }),
  seed => ({ id: "accel-" + seed, title: "Ускорение по графику скорости", prompt: "Скорость выросла с 4 до 16 м/с за 6 с. Найдите ускорение.", answer: 2, unit: "м/с²", topic: "Ускорение", explanation: "a = Δv/Δt = (16 − 4)/6 = 2 м/с²." }),
  seed => ({ id: "fall-" + seed, title: "Свободное падение", prompt: "Тело падает без начальной скорости 3 с. Примите g = 10 м/с². Найдите путь.", answer: 45, unit: "м", topic: "Свободное падение", explanation: "s = gt²/2 = 10·9/2 = 45 м." }),
];

export function generateEgeTasks(count = 8, seed = Date.now()): EgeTask[] {
  return Array.from({ length: count }, (_, index) => taskFactories[Math.abs(seed + index) % taskFactories.length](seed + index));
}
