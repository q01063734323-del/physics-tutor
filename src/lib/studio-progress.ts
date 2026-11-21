export type StudioActivity = { kind: 'task' | 'formula' | 'submission' | 'blitz' | 'topic'; id: string; at: string };
export type StudioCounts = Record<StudioActivity['kind'], number>;
export function studioDay(date: Date) { return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`; }
export function studioCounts(events: StudioActivity[], now: Date): StudioCounts {
  const sets = { task:new Set<string>(),formula:new Set<string>(),submission:new Set<string>(),blitz:new Set<string>(),topic:new Set<string>() };
  for (const event of events) { const date = new Date(event.at); if (sets[event.kind] && Number.isFinite(date.getTime()) && studioDay(date) === studioDay(now)) sets[event.kind].add(event.id); }
  return Object.fromEntries(Object.entries(sets).map(([key,value])=>[key,value.size])) as StudioCounts;
}
export function readStudioEvents(account: string): StudioActivity[] {
  try { const events=JSON.parse(localStorage.getItem(`physics-studio-activity:${account}`)||'[]'); return Array.isArray(events)?events.filter(e=>e&&typeof e.id==='string'&&typeof e.at==='string'&&['task','formula','submission','blitz','topic'].includes(e.kind)).slice(-2000):[]; } catch { return []; }
}
/** Presentation-only daily goals; never changes grading, XP or server progress. */
export function recordStudioActivity(account: string, kind: StudioActivity['kind'], id: string) {
  if (typeof window==='undefined' || !account || !id) return;
  try { const at=new Date().toISOString(), events=readStudioEvents(account); if(events.some(e=>e.kind===kind&&e.id===id&&studioDay(new Date(e.at))===studioDay(new Date(at))))return;
    localStorage.setItem(`physics-studio-activity:${account}`,JSON.stringify([...events,{kind,id,at}].slice(-2000)));window.dispatchEvent(new Event('physics-studio-activity'));
  } catch { /* The lesson still works when local storage is unavailable. */ }
}
