const paths = {
  mic: "M9 6a3 3 0 0 1 6 0v5a3 3 0 0 1-6 0z M5 11a7 7 0 0 0 14 0 M12 18v4 M8 22h8",
  camera: "M3 6h12v12H3z M15 10l6-4v12l-6-4",
  share: "M3 4h18v13H3z M8 21h8 M12 17v4 M12 13V7m-3 3 3-3 3 3",
  chat: "M4 4h16v12H9l-5 4z M8 8h8 M8 12h5",
  layout: "M3 4h18v16H3z M16 4v16 M16 12h5",
  expand: "M3 9V3h6 M15 3h6v6 M21 15v6h-6 M9 21H3v-6",
  settings: "M12 3v3 M12 18v3 M3 12h3 M18 12h3 M6 6l2 2 M16 16l2 2 M6 18l2-2 M16 8l2-2 M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0",
  leave: "M4 15v-4q8-7 16 0v4l-5-1v-3H9v3z",
  close: "m6 6 12 12 M18 6 6 18",
  arrow: "M4 12h16 M14 6l6 6-6 6",
  move: "M12 3v18 M3 12h18 M9 6l3-3 3 3 M9 18l3 3 3-3 M6 9l-3 3 3 3 M18 9l3 3-3 3",
  eye: "M2 12q10-14 20 0-10 14-20 0 M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0",
  board: "M4 4h16v14H4z M8 22l4-4 4 4 M8 9h8 M8 13h5",
} as const;
export function StudioIcon({ name, off = false }: { name: keyof typeof paths; off?: boolean }) {
  return <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name]}/>{off && <path d="m3 3 18 18"/>}</svg>;
}
