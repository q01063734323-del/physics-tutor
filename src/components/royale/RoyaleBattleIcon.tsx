type Name = 'atom' | 'crown' | 'stats' | 'settings' | 'fullscreen' | 'shrink' | 'pause' | 'book' | 'clock' | 'check' | 'close' | 'energy';

const paths: Record<Exclude<Name, 'atom'>, string> = {
  crown: 'm3 7 4.5 4.5L12 4l4.5 7.5L21 7l-2 12H5L3 7Zm2 12h14',
  stats: 'M4 20h16M7 16v-5m5 5V4m5 12V8',
  settings: 'm9 4 1-2h4l1 2 3 2 2 1v4l-2 1-1 3v2l-3 2-2-1-3-2-1-2H6l-2-2 1-3-1-2V7l2-1 3-2Z M15 10a3 3 0 1 1-6 0 3 3 0 0 1 6 0',
  fullscreen: 'M4 9V4h5m6 0h5v5m0 6v5h-5m-6 0H4v-5',
  shrink: 'M4 9h5V4m6 0v5h5m0 6h-5v5m-6 0v-5H4',
  pause: 'M9 5H6v14h3V5Zm9 0h-3v14h3V5Z',
  book: 'M12 5C9 3 5 3 2 4v15c3-1 7-1 10 1 3-2 7-2 10-1V4c-3-1-7-1-10 1Zm0 0v15M5 8l4 1m6 0 4-1M5 12l4 1m6 0 4-1',
  clock: 'M12 9v4l3 2M9 2h6m-3 0v3m6 2 2-2M4 13a8 8 0 1 0 16 0 8 8 0 1 0-16 0Z',
  check: 'm4 12 5 5L20 6',
  close: 'm6 6 12 12M18 6 6 18',
  energy: 'm13 2-8 12h6l-1 8 9-13h-7Z',
};

export function BattleIcon({ name }: { name: Name }) {
  return <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor"
    strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {name === 'atom' ? <>
      <ellipse cx="12" cy="12" rx="10" ry="4.3"/>
      <ellipse cx="12" cy="12" rx="10" ry="4.3" transform="rotate(60 12 12)"/>
      <ellipse cx="12" cy="12" rx="10" ry="4.3" transform="rotate(-60 12 12)"/>
      <circle cx="12" cy="12" r="1.45" fill="currentColor" stroke="none"/>
    </> : <path d={paths[name]} fill={name === 'energy' || name === 'crown' ? 'currentColor' : 'none'}/>}
  </svg>;
}
