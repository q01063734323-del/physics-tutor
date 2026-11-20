"use client";
import { useEffect,useRef,useState } from "react";
import { RoomEvent,type RemoteParticipant,type Room } from "livekit-client";
import { isClassroomId,type ClassroomStroke } from "@/lib/classroom";
import { AnnotationCanvas } from "./drawing/AnnotationCanvas";
const operationsTopic="physics-board-operations-v1";
type BoardProps={label:string;strokes:ClassroomStroke[];accountId:string;canDraw:boolean;canEraseAll?:boolean;onStroke:(stroke:Omit<ClassroomStroke,"author">)=>void;onErase:(id:string)=>void|Promise<unknown>;onUndo:()=>void;onClear?:()=>void|Promise<unknown>;room?:Room|null;peerCanDraw?:boolean};
export function ClassroomBoard(props:BoardProps){
 const redo=useRef<ClassroomStroke[]>([]),latest=useRef(props.strokes);const [hidden,setHidden]=useState<string[]>([]),[error,setError]=useState("");
 useEffect(()=>{latest.current=props.strokes;},[props.strokes]);
 useEffect(()=>{const room=props.room;if(!room)return;let rateAt=0,rateCount=0;const receive=(bytes:Uint8Array,participant?:RemoteParticipant,_kind?:unknown,topic?:string)=>{
  if(topic!==operationsTopic || bytes.length>10000 || !participant || !room.remoteParticipants.has(participant.identity))return;let packet,role;try{packet=JSON.parse(new TextDecoder().decode(bytes));role=JSON.parse(participant.metadata||"{}").role;}catch{return;}
  if(role!=="teacher" && (!props.peerCanDraw || role!=="student"))return;
  if(Date.now()-rateAt>1000){rateAt=Date.now();rateCount=0;}if(++rateCount>30)return;
  const author=participant.identity.startsWith("guest-")?role:participant.identity;
  if(packet.type==="whiteboard:clear" && role==="teacher" && Array.isArray(packet.ids) && packet.ids.length<=160 && packet.ids.every(isClassroomId))setHidden(old=>[...new Set([...old,...packet.ids])]);
  if(packet.type==="whiteboard:erase" && isClassroomId(packet.id) && latest.current.some(stroke=>stroke.id===packet.id && (role==="teacher" || stroke.author===author)))setHidden(old=>[...new Set([...old,packet.id])]);
 };room.on(RoomEvent.DataReceived,receive);return()=>{room.off(RoomEvent.DataReceived,receive);};},[props.room,props.peerCanDraw]);
 function publish(body:object){if(props.room?.state==="connected")void props.room.localParticipant.publishData(new TextEncoder().encode(JSON.stringify(body)),{topic:operationsTopic,reliable:true}).catch(()=>setError("Изменение сохранено; онлайн-уведомление задержалось."));}
 async function erase(id:string){setHidden(old=>[...new Set([...old,id])]);try{await props.onErase(id);publish({type:"whiteboard:erase",id});}catch(problem){setHidden(old=>old.filter(value=>value!==id));setError(problem instanceof Error?problem.message:"Не удалось стереть штрих.");}}
 async function clear(){const ids=props.strokes.map(stroke=>stroke.id);setHidden(old=>[...new Set([...old,...ids])]);try{await props.onClear?.();publish({type:"whiteboard:clear",ids});}catch(problem){setHidden(old=>old.filter(value=>!ids.includes(value)));setError(problem instanceof Error?problem.message:"Очистка не подтверждена.");}}
 const visible=props.strokes.filter(stroke=>!hidden.includes(stroke.id));
 return <>{error&&<p role="status">{error}</p>}<AnnotationCanvas {...props} strokes={visible} onErase={id=>void erase(id)} onUndo={()=>{const last=visible.findLast(stroke=>stroke.author===props.accountId);if(last){redo.current.push(last);void erase(last.id);}}} onRedo={()=>{const stroke=redo.current.pop();if(stroke)props.onStroke({...stroke,id:crypto.randomUUID()});}} onClear={props.canEraseAll&&props.onClear?()=>void clear():undefined} onStroke={stroke=>{redo.current=[];props.onStroke(stroke);}}/></>;
}
