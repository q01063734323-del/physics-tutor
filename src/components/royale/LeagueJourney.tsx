'use client';

import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { leagues, leagueProgress } from '@/lib/royale/leagues';
import type { KingdomQuality } from '@/lib/royale/quality';
import type { mountLeagueWorld } from '@/lib/royale/three/league-world';
import { LeagueBadge } from './KingdomMarks';
import css from './LeagueJourney.module.css';

const numbers=new Intl.NumberFormat('ru-RU');
const numerals=['I','II','III','IV','V','VI'];

export function LeagueJourney({trophies,quality,onBattle}:{trophies:number;quality:KingdomQuality;onBattle:()=>void}){
 const progress=leagueProgress(trophies);
 const [selected,setSelected]=useState(progress.index);
 const [world,setWorld]=useState<'loading'|'ready'|'failed'>('loading');
 const canvas=useRef<HTMLCanvasElement>(null);
 const pins=useRef<(HTMLButtonElement|null)[]>([]);
 const scene=useRef<ReturnType<typeof mountLeagueWorld>|null>(null);
 const latest=useRef(selected);
 const pointers=useRef(new Map<number,{x:number;y:number}>());
 const dragDistance=useRef(0);
 useEffect(()=>{
  let active=true;
  const node=canvas.current;
  if(!node)return;
  setWorld('loading');
  void import('@/lib/royale/three/league-world').then(({mountLeagueWorld})=>{
   if(!active)return;
   scene.current=mountLeagueWorld(node,progress.index,quality,(index,x,y,visible)=>{
    const pin=pins.current[index];
    if(!pin)return;
    pin.hidden=!visible;
    pin.style.translate=`${x}px ${y}px`;
   });
   scene.current.focus(latest.current);
   setWorld('ready');
  }).catch(()=>{if(active)setWorld('failed');});
  return ()=>{active=false;scene.current?.dispose();scene.current=null;};
 },[progress.index,quality]);
 useEffect(()=>{
  const node=canvas.current;
  if(!node)return;
  const wheel=(event:WheelEvent)=>{
   if(!event.ctrlKey&&!event.metaKey)return;
   event.preventDefault();scene.current?.zoom(Math.exp(-event.deltaY*.006),latest.current);
  };
  node.addEventListener('wheel',wheel,{passive:false});
  return ()=>node.removeEventListener('wheel',wheel);
 },[]);
 const choose=(index:number)=>{
  latest.current=index;setSelected(index);scene.current?.focus(index);
 };
 function start(event:PointerEvent<HTMLDivElement>){
  if((event.target as HTMLElement).closest('button')||event.button!==0)return;
  event.currentTarget.setPointerCapture(event.pointerId);
  if(!pointers.current.size)dragDistance.current=0;
  pointers.current.set(event.pointerId,{x:event.clientX,y:event.clientY});
 }
 function move(event:PointerEvent<HTMLDivElement>){
  const old=pointers.current.get(event.pointerId);
  if(!old)return;
  const next={x:event.clientX,y:event.clientY};
  const other=[...pointers.current].find(([id])=>id!==event.pointerId)?.[1];
  if(other){
   const distance=Math.hypot(old.x-other.x,old.y-other.y);
   if(distance>8)scene.current?.zoom(Math.hypot(next.x-other.x,next.y-other.y)/distance,latest.current);
  }else{
   dragDistance.current+=Math.hypot(next.x-old.x,next.y-old.y);
   if(dragDistance.current>3)scene.current?.pan(next.x-old.x,next.y-old.y);
  }
  pointers.current.set(event.pointerId,next);
 }
 const stop=(event:PointerEvent<HTMLDivElement>)=>{pointers.current.delete(event.pointerId);};
 const league=leagues[selected];
 const remaining=Math.max(0,league.trophies-trophies);
 const status=selected===progress.index?'Текущая лига':remaining?'Впереди':'Достигнута';
 return <section className={css.journey} aria-label="Карта лиг">
  <div className={css.map} data-world={world} onPointerDown={start} onPointerMove={move} onPointerUp={stop}
   onPointerCancel={stop} onLostPointerCapture={stop}>
   <canvas ref={canvas} aria-label="Трёхмерная карта парящих королевств"/>
   <div className={css.heading}><p>Небесные королевства</p><h1>Карта лиг</h1></div>
   {world==='loading'&&<p className={css.notice} role="status">Открываем небесную карту…</p>}
   {world==='failed'&&<p className={css.notice} role="status">3D недоступно. Данные всех лиг доступны под картой.</p>}
   {leagues.map((item,index)=><button key={item.name} ref={node=>{pins.current[index]=node;}} type="button" hidden
    className={css.pin} data-current={index===progress.index} data-ahead={index>progress.index}
    aria-pressed={index===selected} onClick={()=>choose(index)}><span>{numerals[index]}</span>{item.name}</button>)}
   <div className={css.camera} aria-label="Камера карты">
    <button type="button" aria-label="Приблизить карту" disabled={world!=='ready'} onClick={()=>scene.current?.zoom(1.22,latest.current)}>+</button>
    <button type="button" aria-label="Отдалить карту" disabled={world!=='ready'} onClick={()=>scene.current?.zoom(1/1.22,latest.current)}>−</button>
    <button type="button" onClick={()=>choose(progress.index)}>К моей лиге</button>
   </div>
  </div>
  <ol className={css.route} aria-label="Все лиги">{leagues.map((item,index)=><li key={item.name}>
   <button type="button" aria-pressed={index===selected} aria-current={index===progress.index?'step':undefined}
    data-ahead={index>progress.index} onClick={()=>choose(index)}>
    <LeagueBadge {...item} symbol={(['spark','compass','atom','compass','atom','crown'] as const)[index]}/>
    <span><b>{item.name}</b><small>{numbers.format(item.trophies)} кубков</small></span>
   </button>
  </li>)}</ol>
  <div className={css.status}>
   <div className={css.details} aria-live="polite">
    <LeagueBadge {...league}/>
    <div><span className={css.overline}>{status} · Лига {numerals[selected]}</span>
     <h3>{league.name}</h3>
     <p>{remaining?`До открытия ещё ${numbers.format(remaining)} кубков`:`Порог лиги — ${numbers.format(league.trophies)} кубков`}</p></div>
   </div>
   <div className={css.progress}>
    <b>{numbers.format(trophies)} кубков</b>
    <progress aria-label="Прогресс до следующей лиги" max={100} value={progress.percent}/>
    <small>{progress.next?`До «${progress.next.name}» — ${numbers.format(progress.next.trophies-trophies)} кубков`:'Высшая лига достигнута'}</small>
   </div>
   <button type="button" className={css.battle} onClick={onBattle}>В бой</button>
  </div>
 </section>;
}
