"use client";
import {useState} from "react";
import type {ClassroomStroke}from"@/lib/classroom";
import {libraryLimits}from"@/lib/library/model";
import {PdfSlide}from"./PdfSlide";
import s from "./Library.module.css";
export function useLocalPresentationPreview(){const [bytes,setBytes]=useState<Uint8Array|null>(null),[page,setPage]=useState(1),[pages,setPages]=useState(1),[annotations,setAnnotations]=useState<Record<number,ClassroomStroke[]>>({}),[error,setError]=useState("");const strokes=annotations[page]||[];
 const controls=<section><p>Локальная проверка PDF и пометок. Файл не загружается на сервер.</p><label>Открыть PDF локально<input type="file" accept=".pdf,application/pdf" onChange={event=>{const file=event.target.files?.[0];if(!file)return;if(file.size>libraryLimits.fileBytes){setError("Максимальный размер — 8 МБ.");return;}void file.arrayBuffer().then(async buffer=>{const {PDFDocument}=await import("pdf-lib");const pdf=await PDFDocument.load(buffer);setPages(pdf.getPageCount());setBytes(new Uint8Array(buffer));setPage(1);setAnnotations({});setError("");}).catch(()=>setError("Не удалось открыть PDF."));}}/></label>{error&&<p role="alert">{error}</p>}{bytes&&<button onClick={()=>setBytes(null)}>Закрыть локальный PDF</button>}</section>;
 const content=bytes?<div className={s.session}><p className={s.hint}>Локальный предпросмотр · PDF не опубликован · без видеозвонка</p><PdfSlide bytes={bytes} page={page} pages={pages} onPage={setPage} drawing={{accountId:"preview",strokes,canDraw:true,canEraseAll:true,onStroke:stroke=>setAnnotations(previous=>({...previous,[page]:[...(previous[page]||[]),{...stroke,author:"preview"}]})),onErase:id=>setAnnotations(previous=>({...previous,[page]:(previous[page]||[]).filter(stroke=>stroke.id!==id)})),onUndo:()=>setAnnotations(previous=>({...previous,[page]:(previous[page]||[]).slice(0,-1)})),onClear:()=>setAnnotations(previous=>({...previous,[page]:[]}))}}/></div>:null;
 return {controls,content};
}
