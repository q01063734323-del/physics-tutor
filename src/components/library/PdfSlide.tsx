"use client";
import { useEffect, useRef, useState, type ComponentProps } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { AnnotationCanvas } from "../drawing/AnnotationCanvas";
import s from "./Library.module.css";
type Props={bytes:Uint8Array;page:number;pages:number;onPage?:(page:number)=>void;drawing?:Omit<ComponentProps<typeof AnnotationCanvas>,"height"|"overlay">;onTiming?:(name:string,ms:number)=>void};
export function PdfSlide({bytes,page,pages,onPage,drawing,onTiming}:Props){
  const canvas=useRef<HTMLCanvasElement>(null),container=useRef<HTMLDivElement>(null),pdf=useRef<PDFDocumentProxy|null>(null),timer=useRef(onTiming);
  const [ready,setReady]=useState(0),[zoom,setZoom]=useState(1),[error,setError]=useState(""),[dimensions,setDimensions]=useState({width:900,height:520}),[rendering,setRendering]=useState(true);
  useEffect(()=>{timer.current=onTiming;},[onTiming]);
  useEffect(()=>{let disposed=false;let destroy:undefined|(()=>void);const started=performance.now();
    import("pdfjs-dist").then(async engine=>{
      if(disposed)return;engine.GlobalWorkerOptions.workerSrc=`/pdf-assets/pdf.worker-${engine.version}.mjs`;
      const task=engine.getDocument({data:new Uint8Array(bytes),enableXfa:false,cMapUrl:"/pdf-assets/cmaps/",cMapPacked:true,standardFontDataUrl:"/pdf-assets/standard_fonts/",wasmUrl:"/pdf-assets/wasm/",stopAtErrors:true,maxImageSize:32000000,canvasMaxAreaInBytes:32000000});
      destroy=()=>{void task.destroy();};const doc=await task.promise;if(disposed){void task.destroy();return;}pdf.current=doc;timer.current?.("Открытие PDF",performance.now()-started);setError("");setReady(value=>value+1);
    }).catch(problem=>{if(!disposed)setError(problem instanceof Error?`Не удалось открыть PDF: ${problem.message}`:"Не удалось открыть PDF.");});
    return()=>{disposed=true;pdf.current=null;destroy?.();};
  },[bytes]);
  useEffect(()=>{const document=pdf.current,el=canvas.current,outer=container.current;if(!document || !el || !outer)return;let disposed=false;let cancel:undefined|(()=>void);let tick=0;
    const draw=()=>{cancel?.();const started=performance.now();void document.getPage(page).then(async pdfPage=>{
      if(disposed)return;const natural=pdfPage.getViewport({scale:1});const width=Math.max(100,outer.clientWidth-24)*zoom,height=width*natural.height/natural.width;const ratio=Math.min(window.devicePixelRatio||1,3);const renderRatio=Math.min(ratio,Math.sqrt(8000000/(width*height)));const viewport=pdfPage.getViewport({scale:width/natural.width*renderRatio});
      setDimensions({width,height});el.width=Math.ceil(viewport.width);el.height=Math.ceil(viewport.height);setRendering(true);
      const render=pdfPage.render({canvas:el,viewport});cancel=()=>render.cancel();try{await render.promise;if(!disposed){setRendering(false);timer.current?.("Переключение слайда",performance.now()-started);}}catch(problem){if(!disposed && !(problem instanceof Error && problem.name==="RenderingCancelledException"))setError("Страница PDF не загрузилась. Звонок продолжается.");}
      if(!disposed){if(page>1)void document.getPage(page-1).catch(()=>undefined);if(page<document.numPages)void document.getPage(page+1).catch(()=>undefined);}
    }).catch(()=>{if(!disposed)setError("Нет такой страницы PDF.");});};
    const schedule=()=>{cancelAnimationFrame(tick);tick=requestAnimationFrame(draw);};schedule();const resize=new ResizeObserver(schedule);resize.observe(outer);return()=>{disposed=true;cancel?.();cancelAnimationFrame(tick);resize.disconnect();};
  },[ready,page,zoom]);
  return <section className={s.viewer} aria-label="PDF-презентация"><div className={s.pdfControls}>{onPage&&<button disabled={page<=1} onClick={()=>onPage(page-1)}>← Назад</button>}<span aria-live="polite">Слайд {page} / {pages}</span>{onPage&&<button disabled={page>=pages} onClick={()=>onPage(page+1)}>Далее →</button>}<button disabled={zoom<=1} onClick={()=>setZoom(value=>Math.max(1,value-.25))} aria-label="Уменьшить слайд">−</button><span>{Math.round(zoom*100)}%</span><button disabled={zoom>=3} onClick={()=>setZoom(value=>Math.min(3,value+.25))} aria-label="Увеличить слайд">+</button></div>{error&&<p role="alert" className={s.error}>{error}</p>}{!ready&&!error&&<p role="status">Открываем PDF…</p>}<div ref={container} className={s.pdfScroll} aria-busy={rendering}><div className={s.pdfPage} style={{width:dimensions.width,height:dimensions.height,marginTop:drawing?.canDraw?150:12}}><canvas ref={canvas} style={{width:"100%",height:"100%"}} aria-label={`Страница ${page} PDF`}/>{drawing&&<AnnotationCanvas {...drawing} overlay height={900*dimensions.height/dimensions.width}/>}</div></div></section>;
}
