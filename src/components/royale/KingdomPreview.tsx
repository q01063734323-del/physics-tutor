'use client';
import { useEffect, useRef, useState } from 'react';
import type { CardId } from '@/lib/royale/config';
import type { GraphicsQuality } from '@/lib/royale/quality';
import type { mountKingdomPreview } from '@/lib/royale/three/kingdom-preview';
import { CardArtwork } from './CardArtwork';
import k from './Kingdom.module.css';

const labels:Record<string,string>={
 Idle:'Ожидание',Walk:'Ходьба',Run:'Бег',Attack:'Атака',Charge:'Рывок',Hit:'Попадание',
 Defeat:'Поражение',Victory:'Победа',Cape:'Плащ',Spawn:'Появление',Fly:'Полёт',Hover:'Парение'
};
export default function KingdomPreview({id,quality}:{id:CardId;quality:GraphicsQuality}) {
 const canvas=useRef<HTMLCanvasElement>(null), player=useRef<ReturnType<typeof mountKingdomPreview>|undefined>(undefined);
 const [clips,setClips]=useState<string[]|null>(null),[failed,setFailed]=useState(false);
 const [selected,setSelected]=useState('');
 useEffect(()=>{
  let active=true;
  const fail=()=>{if(active)setFailed(true);};
  void import('@/lib/royale/three/kingdom-preview').then(module=>{
   if(active&&canvas.current)player.current=module.mountKingdomPreview(canvas.current,id,quality,setClips,fail);
  }).catch(fail);
  return()=>{active=false;player.current?.dispose();player.current=undefined;};
 },[id,quality]);
 return <div>
  <div className={k.previewStage} data-ready={clips!==null&&!failed}>
   {(failed||clips===null)&&<CardArtwork id={id}/>}
   {!failed&&<canvas ref={canvas} aria-label="Трёхмерная модель персонажа"/>}
   {!failed&&clips===null&&<span role="status">Загружаем модель…</span>}
   {failed&&<span role="status">3D недоступно. Показан оригинальный портрет.</span>}
  </div>
  {clips!==null&&!failed&&<div className={k.previewControls}>
   <button aria-label="Повернуть влево" onClick={()=>player.current?.rotate(-.39)}>↶</button>
   <button aria-label="Повернуть вправо" onClick={()=>player.current?.rotate(.39)}>↷</button>
   <button aria-label="Приблизить" onClick={()=>player.current?.zoom(.82)}>+</button>
   <button aria-label="Отдалить" onClick={()=>player.current?.zoom(1.22)}>−</button>
   <button onClick={()=>player.current?.reset()}>Камера</button>
   {clips.length? <label>Анимация <select value={selected} onChange={event=>{
    setSelected(event.target.value);player.current?.play(event.target.value);
   }}><option value="" disabled>Выбрать</option>{clips.map(clip=><option key={clip} value={clip}>{labels[clip]??clip}</option>)}</select></label>
   :<small>В исходной модели нет отдельных клипов.</small>}
  </div>}
 </div>;
}
