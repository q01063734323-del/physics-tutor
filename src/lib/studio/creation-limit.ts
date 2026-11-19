// A bounded per-instance burst guard, in addition to room membership and the two-person cap.
// It is not a distributed quota across several server replicas.
export function createRoomCreationLimit(limit = 3, windowMs = 600_000) {
  const entries = new Map<string, number[]>();
  return (key: string, now = Date.now()) => {
    if (!key || key.length > 256) return false;
    const recent = (entries.get(key) || []).filter(time => now - time < windowMs);
    if (recent.length >= limit) return false;
    if (!entries.has(key) && entries.size >= 1000) entries.delete(entries.keys().next().value!);
    entries.set(key, [...recent, now]); return true;
  };
}
