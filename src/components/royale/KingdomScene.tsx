'use client';
import { useEffect, useRef, useState } from 'react';
import type { GraphicsQuality } from '@/lib/royale/quality';
import k from './Kingdom.module.css';

export function KingdomScene({quality}: {quality:GraphicsQuality}) {
 const canvas=useRef<HTMLCanvasElement>(null);
 const stage=useRef<HTMLDivElement>(null);
 const [recovery,setRecovery]=useState(0);
 const [status,setStatus]=useState<'poster'|'ready'|'fallback'>('poster');
 useEffect(()=>{
  let active=true,cleanup:(()=>void)|undefined,idle:number|undefined;
  const reduce=matchMedia('(prefers-reduced-motion: reduce)');
  const begin=()=>{
   if(reduce.matches||!canvas.current)return;
   void import('@/lib/royale/three/kingdom-scene').then(module=>{
    if(active&&canvas.current)cleanup=module.mountKingdomScene(canvas.current,recovery?'low':quality,()=>setStatus('ready'),()=>setStatus('fallback'));
   }).catch(()=>{if(active)setStatus('fallback');});
  };
  const observer=new IntersectionObserver(([entry])=>{
   if(!entry.isIntersecting)return;
   observer.disconnect();
   idle=window.setTimeout(begin,150);
  },{rootMargin:'100px'});
  if(stage.current)observer.observe(stage.current);
  return()=>{active=false;observer.disconnect();clearTimeout(idle);cleanup?.();};
 },[quality,recovery]);
 return <div className={k.scene} ref={stage} data-scene={status}>
  <div className={k.scenePoster} role={status==='ready'?undefined:'img'} aria-label={status==='ready'?undefined:'Парящий замок'}/>
  {status==='fallback'&&<div className={k.sceneRecovery} role="status">
   <p>3D-вид королевства недоступен.</p>
   <button type="button" onClick={()=>{setRecovery(value=>value+1);setStatus('poster');}}>Повторить в Low</button>
  </div>}
  <canvas key={recovery} ref={canvas} aria-hidden={status!=='ready'} role="img" aria-label="Парящий замок с водопадами и флагами"/>
 </div>;
}
