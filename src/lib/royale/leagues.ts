export const leagues = [
 { name: 'Новичок', trophies: 0, color: '#d7926f', symbol: 'spark' },
 { name: 'Исследователь', trophies: 300, color: '#c1cce7', symbol: 'compass' },
 { name: 'Знаток физики', trophies: 700, color: '#ffc56e', symbol: 'spark' },
 { name: 'Мастер механики', trophies: 1200, color: '#68d9f7', symbol: 'atom' },
 { name: 'Магистр физики', trophies: 1800, color: '#c29bff', symbol: 'atom' },
 { name: 'Легенда Physics Royale', trophies: 2500, color: '#ffe498', symbol: 'crown' },
] as const;

export const matchTrophies = { win: 25, loss: -8, draw: 3 } as const;

export function leagueProgress(trophies: number) {
 const index = Math.max(0, leagues.findLastIndex(league => trophies >= league.trophies));
 const current = leagues[index];
 const next = leagues[index + 1];
 const percent = next ? Math.max(0, Math.min(100, (trophies - current.trophies) * 100 / (next.trophies - current.trophies))) : 100;
 return { current, next, index, percent };
}
