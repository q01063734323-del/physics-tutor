import { useId } from 'react';

const paths = {
 collection: <><path d="m4 7 3-2 3 4M4 7 7 25l4 1M25 8l4 2-3 16-4 2"/><path d="M10 5h14v22H10zM13 10h8m-8 11h8"/><path d="m17 12 3 3-3 4-3-4 3-3Z"/></>,
 battle: <><path d="M4 4l7 2 12 13-4 4L6 11Z"/><path d="m29 4-7 2-7 8m-4 4-4 6 4 4 5-6m3-6 5-5 5-7M5 21l6 6m10-6 6 6m-3-3 4 4m-21-4-3 4"/></>,
 progress: <><path d="m9 10 4 3 3-6 3 6 4-3-2 10H11Z"/><path d="M12 24h8m-4 4C7 28 4 21 4 15m12 13c9 0 12-7 12-13M5 18l4 3m-3-8 3 4m14 4 4-3m-4-1 3-4"/></>,
 stats: <><path d="M4 27h24M7 23V15h4v8m3 0V9h4v14m3 0V4h4v19"/><path d="M5 29h22"/></>,
};

export function KingdomMenuMedal({ name }: { name: keyof typeof paths }) {
 const metal = useId();
 return <svg viewBox="0 0 32 32" aria-hidden="true" fill="none" stroke={`url(#${metal})`} strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round">
  <defs><linearGradient id={metal} x1="0" y1="0" x2=".2" y2="1" gradientUnits="objectBoundingBox">
   <stop stopColor="#fff7d3"/><stop offset=".38" stopColor="#ffd687"/><stop offset=".72" stopColor="#b87334"/><stop offset="1" stopColor="#fff2ab"/>
  </linearGradient></defs>
  {paths[name]}
 </svg>;
}
