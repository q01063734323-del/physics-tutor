"use client";
import { useCallback,useEffect,useRef,useState } from "react";
import { RoomEvent,type RemoteParticipant,type Room } from "livekit-client";
import { emptyPresentation,type LibraryDocument,type PresentationState } from "@/lib/library/model";
import { downloadPdf,fetchPdf,libraryHeaders,libraryRequest,type LibraryContext } from "@/lib/library/client";
import { readLocalRecord,writeLocalRecord } from "@/lib/blitz/storage";
import {canonicalStroke,isClassroomId,type ClassroomStroke} from "@/lib/classroom";
import {drawingTopic,readDrawingEvent} from "@/lib/studio/drawing";
import { PdfSlide } from "./PdfSlide";
import { MaterialsLibrary } from "./MaterialsLibrary";
import s from "./Library.module.css";
const topic="physics-presentation-v1";
type Result={state:PresentationState;document:LibraryDocument|null};
export function usePresentation(context:LibraryContext|undefined,room:Room|null,teacher:boolean){
  const [data,setData]=useState<Result>({state:emptyPresentation,document:null}),[bytes,setBytes]=useState<Uint8Array|null>(null),[error,setError]=useState(""),[notice,setNotice]=useState(""),[history,setHistory]=useState<{id:string;documentId:string;page:number;updatedAt:string}[]>([]),[busy,setBusy]=useState(false),[timings,setTimings]=useState<Record<string,number>>({});
  const drafts=useRef(new Map<string,ClassroomStroke[]>()),hydrated=useRef<Promise<void>|null>(null);
  const draftKey=`library-drafts:${context?.user?.uid || "guest"}:${context?.roomId || "none"}:${teacher?"teacher":"viewer"}`;
  const current=useRef(data),queue=useRef<Promise<unknown>>(Promise.resolve()),pending=useRef(0),sequence=useRef(0),redo=useRef<ClassroomStroke[]>([]),mounted=useRef(true);
  const load=useCallback(async()=>{if(!context)return;const n=++sequence.current;try{hydrated.current??=(teacher?readLocalRecord<Record<string,ClassroomStroke[]>>(draftKey,{}).then(saved=>{for(const [key,value]of Object.entries(saved))drafts.current.set(key,value);}).catch(()=>{setError("Локальные черновики недоступны. Не закрывайте урок до сохранения пометок.");}):Promise.resolve());await hydrated.current;const result=await libraryRequest<Result>(context,"?view=session");const draft= drafts.current.get(`${result.state.documentId}_${result.state.page}`);if(draft)result.state.annotations[result.state.page]=draft;if(n!==sequence.current || !mounted.current || pending.current)return;current.current=result;setData(result);if(!drafts.current.size)setError("");}catch(problem){if(mounted.current)setError(problem instanceof Error?problem.message:"Слайды временно недоступны. Звонок продолжается.");}},[context,draftKey,teacher]);
  const publish=useCallback((type:string)=>{if(room?.state==="connected")void room.localParticipant.publishData(new TextEncoder().encode(JSON.stringify({type,revision:current.current.state.revision,...(type==="presentation:sync-state"?{documentId:current.current.state.documentId,page:current.current.state.page,strokeIds:(current.current.state.annotations[current.current.state.page]||[]).map(stroke=>stroke.id)}:{})})),{topic,reliable:true}).catch(()=>undefined);},[room]);
  const invalidate=useCallback(()=>{sequence.current++;},[]);
  useEffect(()=>{redo.current=[];},[data.document?.id,data.state.page]);
  useEffect(()=>{mounted.current=true;if(!context)return;queueMicrotask(()=>{if(mounted.current)void load();});const refresh=()=>{void load();publish("presentation:sync-request");};const timer=setInterval(()=>void load(),20000);room?.on(RoomEvent.Reconnected,refresh);window.addEventListener("online",refresh);
    return()=>{mounted.current=false;invalidate();clearInterval(timer);room?.off(RoomEvent.Reconnected,refresh);window.removeEventListener("online",refresh);};
  },[context,room,load,publish,invalidate]);
  useEffect(()=>{if(!room || !context)return;let rateAt=0,rateCount=0;const receive=(bytes:Uint8Array,participant?:RemoteParticipant,_kind?:unknown,eventTopic?:string)=>{
    if(!participant || !room.remoteParticipants.has(participant.identity) || bytes.length>14000 || ![topic,drawingTopic].includes(eventTopic||""))return;
    if(eventTopic===topic){if(Date.now()-rateAt>1000){rateAt=Date.now();rateCount=0;}if(++rateCount>20)return;}
    let packet;let role;try{packet=JSON.parse(new TextDecoder().decode(bytes));role=JSON.parse(participant.metadata||"{}").role;}catch{return;}
    if(eventTopic===drawingTopic){
      if(role!=="teacher")return;const event=readDrawingEvent(bytes);const state=current.current.state;
      if(!event || event.type!=="stroke:end" || event.space!==`presentation:${state.documentId}:${state.page}`)return;
      const strokes=state.annotations[state.page]||[];if(strokes.length>=160 || strokes.some(stroke=>stroke.id===event.stroke.id))return;
      const next={...current.current,state:{...state,annotations:{...state.annotations,[state.page]:[...strokes,canonicalStroke(event.stroke,participant.identity)]}}};current.current=next;setData(next);return;
    }
    if(packet.type==="presentation:sync-request"){if(teacher)publish("presentation:sync-state");return;}
    if(role!=="teacher" || !["presentation:open","presentation:page-change","presentation:close","presentation:sync-state"].includes(packet.type))return;
    const state=current.current.state;
    if(packet.type==="presentation:sync-state" && packet.documentId===state.documentId && packet.page===state.page && Array.isArray(packet.strokeIds) && packet.strokeIds.length<=160 && packet.strokeIds.every(isClassroomId)){
      const strokes=state.annotations[state.page]||[];if(packet.strokeIds.every((id:string)=>strokes.some(stroke=>stroke.id===id))){const next={...current.current,state:{...state,annotations:{...state.annotations,[state.page]:strokes.filter(stroke=>packet.strokeIds.includes(stroke.id))}}};current.current=next;setData(next);return;}
    }
    void load();
  };room.on(RoomEvent.DataReceived,receive);publish("presentation:sync-request");return()=>{room.off(RoomEvent.DataReceived,receive);};},[room,context,teacher,load,publish]);
  const documentId=data.document?.id;
  useEffect(()=>{const controller=new AbortController();queueMicrotask(()=>{if(!controller.signal.aborted)setBytes(null);});if(!context || !documentId || !data.state.active)return;void fetchPdf(context,documentId,controller.signal).then(value=>{if(!controller.signal.aborted)setBytes(value);}).catch(problem=>{if(!controller.signal.aborted)setError(problem.message);});return()=>controller.abort();},[context,documentId,data.state.active]); // Document bytes stay mounted while pages change.
  const mutate=useCallback((body:object,event="presentation:sync-state")=>{
    if(!context || !teacher)return Promise.reject(Error("Показом управляет преподаватель."));pending.current++;setBusy(true);setError("");
    const payload=body as {action?:string;documentId?:string;page?:number;strokes?:ClassroomStroke[]};
    const next=queue.current.catch(()=>undefined).then(async()=>{
      if(payload.action==="annotations")await writeLocalRecord(draftKey,Object.fromEntries(drafts.current));
      const result=await libraryRequest(context,"",body);
      if(payload.action==="annotations"){const key=`${payload.documentId}_${payload.page}`;if(drafts.current.get(key)===payload.strokes)drafts.current.delete(key);await writeLocalRecord(draftKey,Object.fromEntries(drafts.current));}
      return result;
    });queue.current=next;
    return next.then(()=>{publish(event);}).catch(problem=>{if(mounted.current)setError(problem instanceof Error?problem.message:"Пометки не сохранены. Звонок продолжается.");throw problem;}).finally(()=>{pending.current--;if(mounted.current && !pending.current){setBusy(false);if(payload.action!=="annotations")void load();}});
  },[context,teacher,publish,load,draftKey]);
  const start=useCallback(async(document:LibraryDocument)=>{if(drafts.current.size)throw Error("Сначала сохраните ожидающие пометки текущего урока.");await mutate({action:"start",documentId:document.id},"presentation:open");},[mutate]);
  function annotations(strokes:ClassroomStroke[]){drafts.current.set(`${current.current.state.documentId}_${current.current.state.page}`,strokes);const next={...current.current,state:{...current.current.state,annotations:{...current.current.state.annotations,[current.current.state.page]:strokes}}};current.current=next;setData(next);void mutate({action:"annotations",documentId:next.state.documentId,page:next.state.page,strokes}).catch(()=>undefined);}
  function stroke(stroke:Omit<ClassroomStroke,"author">){redo.current=[];annotations([...(current.current.state.annotations[current.current.state.page]||[]),{...stroke,author:context?.guestAccess?`guest-${context.roomId}-teacher`:context?.user?.uid||room?.localParticipant.identity||"teacher"}]);}
  function undo(){const strokes=current.current.state.annotations[current.current.state.page]||[];const last=strokes.at(-1);if(last){redo.current.push(last);annotations(strokes.slice(0,-1));}}
  async function exportPdf(){if(!context || !data.document)return;await queue.current;const response=await fetch("/api/library",{method:"POST",cache:"no-store",headers:{...await libraryHeaders(context),"Content-Type":"application/json"},body:JSON.stringify({action:"export",documentId:data.document.id})});if(!response.ok){const result=await response.json();throw Error(result.error);}downloadPdf(new Uint8Array(await response.arrayBuffer()),data.document.name.replace(/\.pdf$/i,"")+" — с пометками.pdf");setNotice("PDF с пометками сформирован.");}
  const reportTiming=useCallback((name:string,ms:number)=>setTimings(previous=>({...previous,[name]:Math.round(ms)})),[]);
  const active=Boolean(data.document && data.state.active);
  const content=active?<section className={s.session}><header className={s.sessionBar}><strong>{data.document!.name}</strong>{teacher&&<><button disabled={busy} onClick={()=>void mutate({action:"close"},"presentation:close").catch(()=>undefined)}>Завершить показ</button><button disabled={busy} onClick={()=>void exportPdf().catch(problem=>setError(problem.message))}>Скачать с пометками</button>{!context?.guestAccess&&<><button disabled={busy} onClick={()=>{if(confirm("Отправить оригинальный PDF ученику этого урока?"))void mutate({action:"share",documentId:data.document!.id,studentId:data.state.studentId,annotated:false}).then(()=>setNotice("Материал отправлен ученику.")).catch(()=>undefined);}}>Отправить оригинал</button><button disabled={busy} onClick={()=>{if(confirm("Сформировать PDF с текущими пометками и отправить ученику этого урока?"))void mutate({action:"share",documentId:data.document!.id,studentId:data.state.studentId,annotated:true}).then(()=>setNotice("PDF с пометками отправлен ученику.")).catch(()=>undefined);}}>Отправить с пометками</button></>}</>}{busy&&<span role="status">Сохраняем…</span>}</header>{error&&<p role="alert" className={s.error}>{error}</p>}{notice&&<p role="status" className={s.notice}>{notice}</p>}{bytes?<PdfSlide bytes={bytes} page={data.state.page} pages={data.document!.pages} onPage={teacher&&!busy?page=>{void mutate({action:"page",page},"presentation:page-change").catch(()=>undefined);}:undefined} onTiming={reportTiming} drawing={{strokes:data.state.annotations[data.state.page]||[],accountId:context?.user?.uid||"teacher",canDraw:teacher,canEraseAll:teacher,onStroke:stroke,onErase:id=>annotations((current.current.state.annotations[current.current.state.page]||[]).filter(stroke=>stroke.id!==id)),onUndo:undo,onRedo:()=>{const last=redo.current.pop();if(last)annotations([...(current.current.state.annotations[current.current.state.page]||[]),{...last,id:crypto.randomUUID()}]);},onClear:()=>annotations([]),room,peerCanDraw:false,space:`presentation:${data.document!.id}:${data.state.page}`}}/>:<p role="status">Открываем презентацию. Видеосвязь продолжается…</p>}</section>:null;
  const retryDrafts=()=>{for(const [key,strokes] of drafts.current){const split=key.lastIndexOf("_");void mutate({action:"annotations",documentId:key.slice(0,split),page:Number(key.slice(split+1)),strokes}).catch(()=>undefined);}};
  const panel=context&&teacher?<><button disabled={busy} onClick={retryDrafts}>Повторить сохранение пометок</button><p className={s.hint}>PDF передаётся как документ: текст и формулы не зависят от битрейта звонка.</p>{error&&<p role="alert" className={s.error}>{error}</p>}{!context.guestAccess&&<><button onClick={()=>void libraryRequest<{sessions:typeof history}>(context,"?view=history").then(result=>setHistory(result.sessions)).catch(problem=>setError(problem.message))}>Продолжить прошлый урок</button>{history.map(item=><button key={item.id} disabled={busy} onClick={()=>{if(confirm("Восстановить прошлый урок этого ученика? Текущие пометки урока будут заменены."))void mutate({action:"resume",fromSession:item.id},"presentation:open").catch(()=>undefined);}}>{new Date(item.updatedAt).toLocaleDateString("ru-RU")} · слайд {item.page}</button>)}</>}<MaterialsLibrary context={context} onPresent={start} compact/></>:<p className={s.hint}>Преподаватель выбирает PDF и управляет страницами. Масштаб просмотра можно менять независимо.</p>;
  return {active,content,panel,timings};
}
