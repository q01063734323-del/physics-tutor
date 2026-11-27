'use client';

import {useEffect,useRef} from 'react';
import type {KingdomQuality} from '@/lib/royale/quality';
import css from './CinematicResult.module.css';

export function ResultHero({result,quality,skip}:{result:string;quality:KingdomQuality;skip:boolean}){
 const canvas=useRef<HTMLCanvasElement>(null);
 useEffect(()=>{
  const node=canvas.current;
  if(!node||skip||quality==='low'||(result!=='win'&&result!=='loss'))return;
  const screen=matchMedia('(min-width: 1050px) and (prefers-reduced-motion: no-preference)');
  let request:AbortController|undefined,dispose:(()=>void)|undefined;
  function sync(){
   request?.abort();dispose?.();dispose=undefined;
   if(!screen.matches||!node)return;
   const controller=new AbortController();request=controller;
   void import('@/lib/royale/three/result-hero').then(({mountResultHero})=>{
    if(!controller.signal.aborted)return mountResultHero(node,result==='win',quality!=='medium',controller.signal);
   }).then(cleanup=>{
    if(controller.signal.aborted)cleanup?.();
    else dispose=cleanup;
   }).catch(()=>{/* Keep the existing portrait if WebGL or the model is unavailable. */});
  }
  sync();screen.addEventListener('change',sync);
  return ()=>{screen.removeEventListener('change',sync);request?.abort();dispose?.();};
 },[result,quality,skip]);
 return <div className={css.heroPortrait} aria-hidden="true"><canvas ref={canvas}/></div>;
}
