'use client';
import { useEffect, useRef, useState, type PointerEvent } from 'react';
import type { CardId } from '@/lib/royale/config';
import type { KingdomQuality } from '@/lib/royale/quality';
import type { mountCollectionStage } from '@/lib/royale/three/collection-stage';
import styles from './CollectionDetail.module.css';

const clipNames:Record<string,string>={
 Idle:'Ожидание',Walk:'Ходьба',Run:'Бег',Attack:'Атака',Charge:'Рывок',Hit:'Попадание',
 Defeat:'Поражение',Victory:'Победа',Cape:'Плащ',Spawn:'Появление',Fly:'Полёт',Hover:'Парение',
};
type Player=ReturnType<typeof mountCollectionStage>;
type Props={id:CardId;name:string;quality:KingdomQuality;showClips:boolean};

export default function CollectionShowcase({id,name,quality,showClips}:Props){
 const canvas=useRef<HTMLCanvasElement>(null),frame=useRef<HTMLElement>(null),gesture=useRef<HTMLDivElement>(null);
 const player=useRef<Player|undefined>(undefined),pending=useRef(id);
 const [view,setView]=useState<{id:CardId;clips:string[];clip:string}|null>(null);
 const [failure,setFailure]=useState<CardId|'webgl'|null>(null);
 const [retry,setRetry]=useState(0);
 const fingers=useRef(new Map<number,{x:number;y:number}>());
 useEffect(()=>{
  let current=true,instance:Player|undefined;
  void import('@/lib/royale/three/collection-stage').then(module=>{
   if(!current||!canvas.current||!frame.current)return;
   instance=module.mountCollectionStage(canvas.current,frame.current,quality,
    (ready,clips,clip)=>{if(current){setView({id:ready,clips,clip});setFailure(null);}},
    card=>{if(current)setFailure(card??'webgl');});
   player.current=instance;instance.choose(pending.current);
  }).catch(()=>{if(current)setFailure('webgl');});
  return()=>{current=false;instance?.dispose();player.current=undefined;};
 },[quality,retry]);
 useEffect(()=>{pending.current=id;player.current?.choose(id);},[id]);
 useEffect(()=>{
  const area=gesture.current;
  const wheel=(event:WheelEvent)=>{
   if(!event.ctrlKey||!player.current)return;
   event.preventDefault();
   player.current.zoom(Math.exp(Math.max(-.24,Math.min(.24,event.deltaY*.006))));
  };
  area?.addEventListener('wheel',wheel,{passive:false});
  return()=>area?.removeEventListener('wheel',wheel);
 },[]);
 const state=failure==='webgl'||failure===id?'failed':view?.id===id?'ready':'loading';
 function start(event:PointerEvent<HTMLElement>){
  if(event.pointerType==='mouse'&&event.button!==0)return;
  fingers.current.set(event.pointerId,{x:event.clientX,y:event.clientY});
  event.currentTarget.setPointerCapture(event.pointerId);
 }
 function drag(event:PointerEvent<HTMLElement>){
  const previous=fingers.current.get(event.pointerId);
  if(!previous)return;
  const other=Array.from(fingers.current).find(([key])=>key!==event.pointerId)?.[1];
  if(other){
   const old=Math.hypot(other.x-previous.x,other.y-previous.y);
   const now=Math.hypot(other.x-event.clientX,other.y-event.clientY);
   if(old>8&&now>8)player.current?.zoom(old/now);
  }else{
   const difference=event.clientX-previous.x;
   if(event.pointerType!=='touch'||Math.abs(difference)>=.65*Math.abs(event.clientY-previous.y))player.current?.rotate(difference*.011);
  }
  fingers.current.set(event.pointerId,{x:event.clientX,y:event.clientY});
 }
 const stop=(event:PointerEvent<HTMLElement>)=>{fingers.current.delete(event.pointerId);};
 return <>
  <div className={styles.hall}><canvas key={retry} ref={canvas} aria-hidden="true"/></div>
  <figure className={styles.showcase} ref={frame} aria-label={'Презентация · '+name} data-showcase={state}>
   <div className={styles.gesture} ref={gesture} data-collection-gesture role="group" aria-label="Вращение модели"
    onPointerDown={start} onPointerMove={drag} onPointerUp={stop} onPointerCancel={stop} onLostPointerCapture={stop}/>
   <div className={styles.stageLegend}><span aria-hidden="true">✦</span> Королевский научный зал</div>
   {state==='loading'&&<p className={styles.canvasStatus} role="status">Загружаем модель…</p>}
   {state==='failed'&&<div className={styles.canvasStatus} role="status"><p>3D-сцена недоступна.</p><button onClick={()=>{setFailure(null);setView(null);setRetry(value=>value+1);}}>Повторить</button></div>}
   <figcaption className={styles.stageTools}>
    <div role="group" aria-label="Камера персонажа">
     <button aria-label="Повернуть влево" disabled={state!=='ready'} onClick={()=>player.current?.rotate(-.36)}>↶</button>
     <button aria-label="Повернуть вправо" disabled={state!=='ready'} onClick={()=>player.current?.rotate(.36)}>↷</button>
     <button aria-label="Приблизить" disabled={state!=='ready'} onClick={()=>player.current?.zoom(.84)}>+</button>
     <button aria-label="Отдалить" disabled={state!=='ready'} onClick={()=>player.current?.zoom(1.19)}>−</button>
     <button aria-label="Сбросить камеру" disabled={state!=='ready'} onClick={()=>player.current?.reset()}>⌖</button>
    </div>
    {showClips&&state==='ready'&&view&&(view.clips.length?
     <label>Анимация <select aria-label="Анимация" value={view.clip} onChange={event=>{const clip=event.target.value;player.current?.play(clip);setView({...view,clip});}}>
      {!view.clip&&<option value="" disabled>Выберите</option>}{view.clips.map(clip=><option key={clip} value={clip}>{clipNames[clip]??clip}</option>)}
     </select></label>:<small>У исходной модели нет отдельных клипов.</small>)}
   </figcaption>
  </figure>
 </>;
}
