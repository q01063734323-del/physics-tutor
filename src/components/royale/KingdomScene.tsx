'use client';
import { useEffect, useRef, useState } from 'react';
import type { GraphicsQuality } from '@/lib/royale/quality';
import k from './Kingdom.module.css';

export function KingdomScene({quality}: {quality:GraphicsQuality}) {
 const canvas=useRef<HTMLCanvasElement>(null);
 const stage=useRef<HTMLDivElement>(null);
 const [status,setStatus]=useState<'poster'|'ready'|'fallback'>('poster');
 useEffect(()=>{
  let active=true,cleanup:(()=>void)|undefined,idle:number|undefined;
  const reduce=matchMedia('(prefers-reduced-motion: reduce)');
  const begin=()=>{
   if(reduce.matches||!canvas.current)return;
   void import('@/lib/royale/three/kingdom-scene').then(module=>{
    if(active&&canvas.current)cleanup=module.mountKingdomScene(canvas.current,quality,()=>setStatus('ready'),()=>setStatus('fallback'));
   }).catch(()=>{if(active)setStatus('fallback');});
  };
  const observer=new IntersectionObserver(([entry])=>{
   if(!entry.isIntersecting)return;
   observer.disconnect();
   idle=window.setTimeout(begin,150);
  },{rootMargin:'100px'});
  if(stage.current)observer.observe(stage.current);
  return()=>{active=false;observer.disconnect();clearTimeout(idle);cleanup?.();};
 },[quality]);
 return <div className={k.scene} ref={stage} data-scene={status}>
  <div className={k.scenePoster} role={status==='ready'?undefined:'img'} aria-label={status==='ready'?undefined:'Парящий замок'}/>
  <canvas ref={canvas} aria-hidden={status!=='ready'} role="img" aria-label="Парящий замок с водопадами и флагами"/>
 </div>;
}
