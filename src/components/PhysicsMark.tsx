import Link from "next/link";

export function PhysicsMark() {
  return <Link href="/" className="pt-brand"><span aria-hidden="true">φ</span><strong>Physics Tutor</strong></Link>;
}

const icons = {
  home: "M3 10 12 3l9 7v10H3z M9 20v-6h6v6",
  tasks: "M6 3h9l4 4v14H6z M9 11h7 M9 15h7",
  progress: "M4 20V4 M4 20h16 M8 16l4-5 3 2 5-7",
  people: "M16 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2 M15 5a4 4 0 0 1 0 7 M21 21v-2a4 4 0 0 0-3-4 M13 8a4 4 0 1 1-8 0 4 4 0 0 1 8 0",
  profile: "M4 21v-2a4 4 0 0 1 4-4h8a4 4 0 0 1 4 4v2 M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0",
  book: "M4 4h6l2 2 2-2h6v15h-6l-2 2-2-2H4z M12 6v15",
  lab: "M9 3h6 M10 3v7l-6 9a1 1 0 0 0 1 2h14a1 1 0 0 0 1-2l-6-9V3 M7 15h10",
  video: "M3 6h12v12H3z M15 10l6-4v12l-6-4",
  arrow: "M4 12h15 M13 6l6 6-6 6",
  mic: "M9 6a3 3 0 0 1 6 0v5a3 3 0 0 1-6 0z M5 11a7 7 0 0 0 14 0 M12 18v4 M3 3l18 18",
  screen: "M3 4h18v13H3z M8 21h8 M12 17v4 M12 14V7m-3 3 3-3 3 3",
  pen: "m4 20 5-1L20 8l-4-4L5 15z M13 7l4 4",
  calendar: "M4 6h16v15H4z M4 10h16 M8 3v5 M16 3v5",
  bell: "M5 17h14l-2-3V9a5 5 0 0 0-10 0v5z M10 21h4",
  menu: "M4 6h16 M4 12h16 M4 18h16",
} as const;

export function PhysicsIcon({ name, size = 20 }: { name: keyof typeof icons; size?: number }) {
  return <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round"><path d={icons[name]} /></svg>;
}
export type PhysicsIconName = keyof typeof icons;
