import type { CSSProperties } from 'react';
import k from './Kingdom.module.css';

const marks = {
 atom: <><ellipse cx="16" cy="16" rx="13" ry="5"/><ellipse cx="16" cy="16" rx="13" ry="5" transform="rotate(60 16 16)"/><ellipse cx="16" cy="16" rx="13" ry="5" transform="rotate(-60 16 16)"/><circle cx="16" cy="16" r="1.35" fill="currentColor"/></>,
 crown: <><path d="m4 10 5 5 7-8 7 8 5-5-3 14H7Z"/><path d="M8 26h16"/></>,
 spark: <path d="M16 3l3.5 8.6 9.5.7-7.4 6.2 2.7 9.5-8.3-5.3L7.7 28l2.7-9.5L3 12.3l9.5-.7Z"/>,
 compass: <><circle cx="16" cy="16" r="12"/><path d="m20 10-2 8-8 4 3-8Z"/></>,
 stats: <path d="M5 26h23M8 22V14m8 8V6m8 16V10"/>,
 cube: <path d="m16 3 12 7v12l-12 7-12-7V10Zm0 14 12-7M16 17 4 10m12 7v12"/>,
};
export function KingdomMark({name, size=28}: {name:keyof typeof marks;size?:number}) {
 return <svg width={size} height={size} viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{marks[name]}</svg>;
}
export function LeagueBadge({color,symbol}: {color:string;symbol:'atom'|'crown'|'spark'|'compass'}) {
 return <span aria-hidden="true" className={k.leagueBadge} style={{'--badge':color} as CSSProperties}><KingdomMark name={symbol}/></span>;
}
