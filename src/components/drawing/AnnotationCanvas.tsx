"use client";
import { useCallback, useEffect, useRef, useState, type PointerEvent } from "react";
import { RoomEvent, type RemoteParticipant, type Room } from "livekit-client";
import { classroomPointLimit, type ClassroomStroke } from "@/lib/classroom";
import { drawingTopic, hitStroke, readDrawingEvent, shapePoints, smoothStroke, type DrawingEvent } from "@/lib/studio/drawing";
import s from "./Drawing.module.css";
type Props={strokes:ClassroomStroke[];accountId:string;canDraw:boolean;canEraseAll?:boolean;onStroke:(stroke:Omit<ClassroomStroke,"author">)=>void;onErase:(id:string)=>void;onUndo:()=>void;onRedo?:()=>void;onClear?:()=>void;room?:Room|null;space?:string;peerCanDraw?:boolean;height?:number;overlay?:boolean;label?:string};
export function AnnotationCanvas({strokes,accountId,canDraw,canEraseAll,onStroke,onErase,onUndo,onRedo,onClear,room,space="board",peerCanDraw=true,height=520,overlay=false,label="Общая доска"}:Props){
  const canvas=useRef<HTMLCanvasElement>(null),base=useRef<HTMLCanvasElement|null>(null),local=useRef<Omit<ClassroomStroke,"author">|null>(null),remote=useRef(new Map<string,{stroke:ClassroomStroke;seq:number;at:number}>()),pointer=useRef<number|null>(null),frame=useRef(0),lastSend=useRef(0),seq=useRef(0),paintCount=useRef(0);
  const latest=useRef(strokes);const [tool,setTool]=useState("pen"),[color,setColor]=useState("#163b31"),[width,setWidth]=useState(3),[network,setNetwork]=useState("");
  const paint=useCallback(()=>{if(frame.current)return;frame.current=requestAnimationFrame(()=>{frame.current=0;const el=canvas.current,ctx=el?.getContext("2d");if(!el || !ctx)return;const sx=el.width/900,sy=el.height/height;ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,el.width,el.height);if(base.current)ctx.drawImage(base.current,0,0);ctx.setTransform(sx,0,0,sy,0,0);const now=Date.now();for(const [id,item] of remote.current){if(now-item.at>15000){remote.current.delete(id);continue;}smoothStroke(ctx,item.stroke);}if(local.current)smoothStroke(ctx,local.current);paintCount.current++;});},[height]);
  useEffect(()=>{latest.current=strokes;for(const stroke of strokes)remote.current.delete(stroke.id);const el=canvas.current;if(!el)return;
    const redraw=()=>{const rect=el.getBoundingClientRect();if(!rect.width || !rect.height)return;const ratio=Math.min(window.devicePixelRatio||1,3);const budget=Math.min(1,Math.sqrt(8000000/(rect.width*rect.height*ratio*ratio)));el.width=Math.max(1,Math.round(rect.width*ratio*budget));el.height=Math.max(1,Math.round(rect.height*ratio*budget));base.current=document.createElement("canvas");base.current.width=el.width;base.current.height=el.height;const ctx=base.current.getContext("2d");if(ctx){ctx.scale(el.width/900,el.height/height);for(const stroke of latest.current)smoothStroke(ctx,stroke);}paint();};
    redraw();const resize=new ResizeObserver(redraw);resize.observe(el);return()=>resize.disconnect();
  },[strokes,height,paint]);
  const emit=useCallback((type:DrawingEvent["type"],stroke:Omit<ClassroomStroke,"author">)=>{
    if(!room || room.state!=="connected")return;const packet:DrawingEvent={type,space,seq:++seq.current,stroke};
    void room.localParticipant.publishData(new TextEncoder().encode(JSON.stringify(packet)),{topic:drawingTopic,reliable:type!=="stroke:point"}).catch(()=>setNetwork("Онлайн-штрих задерживается. Итог сохраняется отдельно."));
  },[room,space]);
  useEffect(()=>{if(!room)return;const drafts=remote.current;const rates=new Map<string,{start:number;count:number}>();
    const receive=(bytes:Uint8Array,participant?:RemoteParticipant,_kind?:unknown,topic?:string)=>{
      if(topic!==drawingTopic || !participant || !room.remoteParticipants.has(participant.identity))return;
      let role="";try{role=JSON.parse(participant.metadata||"{}").role;}catch{return;}
      if(role!=="teacher" && (!peerCanDraw || role!=="student"))return;
      const rate=rates.get(participant.identity);if(rate && Date.now()-rate.start<1000){if(++rate.count>70)return;}else rates.set(participant.identity,{start:Date.now(),count:1});
      const event=readDrawingEvent(bytes);if(!event || event.space!==space)return;
      const old=remote.current.get(event.stroke.id);if(old && (old.stroke.author!==participant.identity || old.seq>=event.seq))return;
      if(event.type==="stroke:cancel"){remote.current.delete(event.stroke.id);paint();return;}
      if(latest.current.some(stroke=>stroke.id===event.stroke.id))return;
      if(!old && remote.current.size>=8)return;
      remote.current.set(event.stroke.id,{stroke:{...event.stroke,author:participant.identity},seq:event.seq,at:Date.now()});paint();
    };
    room.on(RoomEvent.DataReceived,receive);return()=>{room.off(RoomEvent.DataReceived,receive);drafts.clear();};
  },[room,space,peerCanDraw,paint]);
  useEffect(()=>()=>{cancelAnimationFrame(frame.current);if(local.current)emit("stroke:cancel",local.current);},[emit]);
  function point(event:{clientX:number;clientY:number}){const r=canvas.current!.getBoundingClientRect();return `${Math.max(0,Math.min(900,(event.clientX-r.left)/r.width*900)).toFixed(1)},${Math.max(0,Math.min(height,(event.clientY-r.top)/r.height*height)).toFixed(1)}`;}
  function start(event:PointerEvent<HTMLCanvasElement>){if(!canDraw || event.button!==0 || pointer.current!==null)return;event.preventDefault();const p=point(event);
    if(tool==="eraser"){const hit=[...strokes].reverse().find(stroke=>(canEraseAll || stroke.author===accountId)&&hitStroke(stroke,p));if(hit)onErase(hit.id);return;}
    event.currentTarget.setPointerCapture(event.pointerId);pointer.current=event.pointerId;local.current={id:crypto.randomUUID(),points:[p,p],color,width:tool==="marker"?Math.min(24,width*4):width,tool:tool as ClassroomStroke["tool"]};lastSend.current=0;emit("stroke:start",local.current);paint();}
  function move(event:PointerEvent<HTMLCanvasElement>){if(!canDraw || !local.current || pointer.current!==event.pointerId)return;event.preventDefault();const events=event.nativeEvent.getCoalescedEvents?.()||[event.nativeEvent];
    for(const sample of events){const p=point(sample);if(tool==="pen" || tool==="marker"){if(local.current.points.at(-1)===p)continue;if(local.current.points.length>=classroomPointLimit)local.current.points=local.current.points.filter((_,i)=>i%2===0);local.current.points.push(p);}else local.current.points=shapePoints(tool,local.current.points[0],p);}
    paint();if(performance.now()-lastSend.current>40){emit("stroke:point",{...local.current,points:[...local.current.points]});lastSend.current=performance.now();}}
  function finish(event:PointerEvent<HTMLCanvasElement>,cancel=false){if(pointer.current!==event.pointerId)return;const stroke=local.current;pointer.current=null;local.current=null;if(stroke){if(cancel || !canDraw)emit("stroke:cancel",stroke);else{emit("stroke:end",stroke);onStroke(stroke);}}paint();}
  return <section className={`${s.editor} ${overlay?s.overlay:""}`} aria-label={label}>{(!overlay || canDraw) && <div className={s.tools} role="group" aria-label="Инструменты рисования">{[["pen","Ручка"],["marker","Маркер"],["eraser","Ластик"],["arrow","Стрелка"],["line","Линия"],["rectangle","Прямоугольник"]].map(([id,label])=><button key={id} disabled={!canDraw} aria-pressed={tool===id} onClick={()=>setTool(id)}>{label}</button>)}<label>Цвет<input type="color" aria-label="Цвет штриха" value={color} disabled={!canDraw} onChange={e=>setColor(e.target.value)}/></label><label>Толщина<select aria-label="Толщина штриха" disabled={!canDraw} value={width} onChange={e=>setWidth(Number(e.target.value))}>{[2,3,5,8].map(n=><option key={n} value={n}>{n}</option>)}</select></label><button disabled={!canDraw || !strokes.length} onClick={onUndo}>Отменить</button>{onRedo&&<button disabled={!canDraw} onClick={onRedo}>Повторить</button>}{onClear&&<button disabled={!canDraw || !strokes.length} onClick={()=>{if(confirm("Очистить пометки на этой странице?"))onClear();}}>Очистить страницу</button>}</div>}<div className={s.surface} style={{aspectRatio:`900 / ${height}`,background:overlay?"transparent":"#f7f9f3"}}><canvas ref={canvas} aria-label="Область для рисования" role="img" onPointerDown={start} onPointerMove={move} onPointerUp={event=>finish(event)} onPointerCancel={event=>finish(event,true)} onLostPointerCapture={event=>finish(event,true)}/>{!strokes.length && !overlay && <span className={s.hint}>{canDraw?"Рисуйте мышью, пером или касанием":"Общая доска · только просмотр"}</span>}</div>{network&&<p role="status">{network}</p>}</section>;
}
