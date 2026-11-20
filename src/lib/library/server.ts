import "server-only";
import { randomUUID, createHash } from "node:crypto";
import { PDFDocument, PDFDict, PDFArray, PDFName, rgb, LineCapStyle } from "pdf-lib";
import { LibraryError, grantId, type LibraryActor } from "./access";
import { emptyPresentation, isLibraryId, libraryLimits, libraryName, type LibraryDocument, type PresentationState } from "./model";
import type { ClassroomStroke } from "../classroom";
export async function validatePdf(bytes:Uint8Array){
  if(!bytes.length || bytes.length>libraryLimits.fileBytes || !Buffer.from(bytes.subarray(0,5)).equals(Buffer.from("%PDF-")))throw new LibraryError("Нужен PDF размером до 8 МБ.");
  let pdf:PDFDocument;try{pdf=await PDFDocument.load(bytes,{ignoreEncryption:false,updateMetadata:false});}catch{throw new LibraryError("PDF повреждён или защищён паролем. Экспортируйте обычный PDF.");}
  if(!pdf.getPageCount() || pdf.getPageCount()>libraryLimits.pages)throw new LibraryError("Допустимо от 1 до 300 страниц.");
  for(const page of pdf.getPages()){const box=page.getCropBox();if(box.width<=0 || box.height<=0 || Math.max(box.width/box.height,box.height/box.width)>10)throw new LibraryError("Неподдерживаемые пропорции страницы PDF.");}
  const seen=new Set<unknown>();let nodes=0;
  function inspect(obj:unknown,depth=0){if(seen.has(obj))return;if(++nodes>250000 || depth>100)throw new LibraryError("Слишком сложная структура PDF.");seen.add(obj);
    if(obj instanceof PDFDict){if(["JS","JavaScript","AA","EmbeddedFiles","RichMedia","XFA"].some(key=>obj.has(PDFName.of(key))) || ["/JavaScript","/Launch","/GoToR","/SubmitForm","/ImportData","/Rendition","/Movie","/Sound"].includes(String(obj.get(PDFName.of("S")))))throw new LibraryError("PDF содержит активные действия или вложения. Экспортируйте статическую презентацию.");if(String(obj.get(PDFName.of("Type")))==="/EmbeddedFile" || String(obj.get(PDFName.of("Subtype")))==="/FileAttachment")throw new LibraryError("PDF содержит вложение. Экспортируйте статическую презентацию.");for(const [,value]of obj.entries())inspect(value,depth+1);}
    else if(obj instanceof PDFArray)for(const value of obj.asArray())inspect(value,depth+1);else if(obj && typeof obj==="object" && "dict" in obj && obj.dict instanceof PDFDict)inspect(obj.dict,depth+1);
  }
  for(const [,obj]of pdf.context.enumerateIndirectObjects())inspect(obj);
  return pdf;
}
export async function ownedDocument(actor:LibraryActor,id:unknown){
  if(!isLibraryId(id))throw new LibraryError("Некорректный материал.");
  const snapshot=await actor.db.doc(`libraryDocuments/${id}`).get();const doc=snapshot.data() as LibraryDocument|undefined;
  if(!doc || doc.status!=="ready" || (doc.expiresAt && doc.expiresAt<=Date.now()))throw new LibraryError("Материал недоступен.",404);
  return {...doc,id};
}
export async function readableDocument(actor:LibraryActor,id:unknown){
  const doc=await ownedDocument(actor,id);
  if(actor.teacher && doc.ownerId===actor.ownerId)return doc;
  if(actor.roomId){const session=await actor.db.doc(`librarySessions/${actor.guest?"guest-":""}${actor.roomId}`).get();if(session.get("documentId")===doc.id && session.get("ownerId")===doc.ownerId && session.get("active"))return doc;}
  if(!actor.guest && (await actor.db.doc(`libraryGrants/${grantId(doc.id,actor.id)}`).get()).get("active")===true)return doc;
  throw new LibraryError("Преподаватель не открыл доступ к этому материалу.",403);
}
export async function documentBytes(actor:LibraryActor,doc:LibraryDocument){
  const count=Math.ceil(doc.bytes/libraryLimits.chunkBytes);const chunks=await actor.db.getAll(...Array.from({length:count},(_,i)=>actor.db.doc(`libraryDocuments/${doc.id}/chunks/${String(i).padStart(3,"0")}`)));
  if(chunks.some(chunk=>!chunk.exists))throw new LibraryError("Файл сохранён не полностью.",503);
  const bytes=Buffer.concat(chunks.map(chunk=>Buffer.from(chunk.get("bytes"))));if(bytes.length!==doc.bytes)throw new LibraryError("Повреждённый файл.",503);return bytes;
}
export async function storeDocument(actor:LibraryActor,bytes:Uint8Array,name:string,folderId:string,derivedFrom?:string){
  const pdf=await validatePdf(bytes);await purgeExpiredGuestDocuments(actor).catch(()=>undefined);const id=randomUUID();const document:LibraryDocument={id,ownerId:actor.ownerId,name:libraryName(name),folderId,bytes:bytes.length,pages:pdf.getPageCount(),createdAt:new Date().toISOString(),status:"ready",kind:derivedFrom?"annotated":"original",...(derivedFrom?{derivedFrom}:{}),...(actor.guest?{expiresAt:actor.expiresAt}:{})};
  const quota=actor.db.doc(`libraryAccounts/${actor.ownerId}`);
  const hash=createHash("sha256").update(bytes).digest("hex"),hashRef=actor.db.doc(`libraryHashes/${createHash("sha256").update(actor.ownerId+":"+hash).digest("hex")}`);
  let saved=document;
  await actor.db.runTransaction(async tx=>{
    const index=await tx.get(hashRef);
    if(index.exists){const old=await tx.get(actor.db.doc(`libraryDocuments/${index.get("documentId")}`));if(old.get("status")==="ready"){saved=old.data() as LibraryDocument;return;}}
    const used=await tx.get(quota);if((used.get("bytes")||0)+bytes.length>(actor.guest?libraryLimits.fileBytes:libraryLimits.totalBytes) || (used.get("count")||0)>=(actor.guest?3:libraryLimits.documents))throw new LibraryError("Лимит библиотеки: 64 МБ и 100 файлов. Удалите ненужные материалы.",409);
    tx.set(quota,{bytes:(used.get("bytes")||0)+bytes.length,count:(used.get("count")||0)+1});
    tx.set(hashRef,{documentId:id});
    tx.create(actor.db.doc(`libraryDocuments/${id}`),{...document,sha256:hash});
    for(let offset=0,index=0;offset<bytes.length;offset+=libraryLimits.chunkBytes,index++)tx.create(actor.db.doc(`libraryDocuments/${id}/chunks/${String(index).padStart(3,"0")}`),{bytes:Buffer.from(bytes.subarray(offset,offset+libraryLimits.chunkBytes))});
  });return saved;
}
export const sessionId=(actor:LibraryActor)=>{if(!actor.roomId)throw new LibraryError("Откройте онлайн-урок.");return `${actor.guest?"guest-":""}${actor.roomId}`;};
export async function readPresentation(actor:LibraryActor){const id=sessionId(actor);const data=(await actor.db.doc(`librarySessions/${id}`).get()).data();return { ...emptyPresentation,...data,annotations:{},sessionId:id } as PresentationState & {sessionId:string;ownerId?:string;baseSessionId?:string;annotationBytes?:number};}
export async function readAnnotations(actor:LibraryActor,id:string,documentId:string,page:number){
  let current=id;
  for(let depth=0;depth<6 && current;depth++){
    const session=await actor.db.doc(`librarySessions/${current}`).get();
    if(session.get("ownerId")!==actor.ownerId || session.get("studentId")!==actor.studentId)return [];
    const found=await actor.db.doc(`librarySessions/${current}/pages/${documentId}_${page}`).get();if(found.exists)return (found.get("strokes")||[]) as ClassroomStroke[];
    current=session.get("baseSessionId") || "";
  }return [];
}
export async function annotatedPdf(actor:LibraryActor,doc:LibraryDocument,fromSession:string){
  const session=await actor.db.doc(`librarySessions/${fromSession}`).get();
  if(session.get("ownerId")!==actor.ownerId || session.get("studentId")!==actor.studentId)throw new LibraryError("Недоступные пометки.",403);
  const pdf=await validatePdf(await documentBytes(actor,doc));
  for(let index=0;index<doc.pages;index++){
    const strokes=await readAnnotations(actor,fromSession,doc.id,index+1);if(!strokes.length)continue;
    const page=pdf.getPage(index);const box=page.getCropBox();const rotation=((page.getRotation().angle%360)+360)%360;const rw=rotation%180?box.height:box.width,rh=rotation%180?box.width:box.height;
    const map=(point:string)=>{const [x,y]=point.split(",").map(Number);const rx=x/900*rw,ry=y/(900*rh/rw)*rh;return rotation===90?{x:box.x+ry,y:box.y+rx}:rotation===180?{x:box.x+box.width-rx,y:box.y+ry}:rotation===270?{x:box.x+box.width-ry,y:box.y+box.height-rx}:{x:box.x+rx,y:box.y+box.height-ry};};
    for(const stroke of strokes){const color=rgb(parseInt(stroke.color.slice(1,3),16)/255,parseInt(stroke.color.slice(3,5),16)/255,parseInt(stroke.color.slice(5,7),16)/255);const points=stroke.points.map(map);const thickness=(stroke.width||3)*rw/900;
      const pair=(point:{x:number;y:number})=>`${point.x} ${-point.y}`;let path=`M ${pair(points[0])}`;
      if(stroke.tool==="line" || stroke.tool==="arrow" || stroke.tool==="rectangle")for(const point of points.slice(1))path+=` L ${pair(point)}`;
      else {for(let p=1;p<points.length-1;p++)path+=` Q ${pair(points[p])} ${pair({x:(points[p].x+points[p+1].x)/2,y:(points[p].y+points[p+1].y)/2})}`;path+=` L ${pair(points.at(-1)!)}`;}
      page.drawSvgPath(path,{x:0,y:0,borderColor:color,borderWidth:thickness,borderOpacity:stroke.tool==="marker"?.28:1,borderLineCap:LineCapStyle.Round});
    }
  }return pdf.save();
}

export async function deleteLibraryDocument(actor:LibraryActor,id:unknown){
  if(!actor.teacher || !isLibraryId(id))throw new LibraryError("Нет доступа к удалению.",403);
  const ref=actor.db.doc(`libraryDocuments/${id}`),quota=actor.db.doc(`libraryAccounts/${actor.ownerId}`);
  const document=await ref.get();if(!document.exists)return;
  if(document.get("ownerId")!==actor.ownerId)throw new LibraryError("Это материал другого преподавателя.",403);
  await ref.update({status:"deleted"}); // Access is revoked before storage cleanup; quota is held until bytes are removed.
  const [chunks,grants]=await Promise.all([ref.collection("chunks").get(),actor.db.collection("libraryGrants").where("documentId","==",id).get()]);
  const refs=[...chunks.docs,...grants.docs].map(doc=>doc.ref);
  for(let offset=0;offset<refs.length;offset+=400){const batch=actor.db.batch();for(const item of refs.slice(offset,offset+400))batch.delete(item);await batch.commit();}
  await actor.db.runTransaction(async tx=>{
    const [current,used]=await Promise.all([tx.get(ref),tx.get(quota)]);if(!current.exists)return;
    const hashRef=actor.db.doc(`libraryHashes/${createHash("sha256").update(actor.ownerId+":"+current.get("sha256")).digest("hex")}`),hash=await tx.get(hashRef);
    tx.set(quota,{bytes:Math.max(0,(used.get("bytes")||0)-current.get("bytes")),count:Math.max(0,(used.get("count")||0)-1)});
    if(hash.get("documentId")===id)tx.delete(hashRef);tx.delete(ref);
  });
}

// Bounded maintenance during an authorized upload; no paid scheduler and no public cleanup endpoint.
export async function purgeExpiredGuestDocuments(actor:LibraryActor){
  const expired=await actor.db.collection("libraryDocuments").where("expiresAt","<=",Date.now()).limit(2).get();
  for(const doc of expired.docs){const owner=doc.get("ownerId"),expires=doc.get("expiresAt");if(typeof owner==="string" && /^guest-[a-f0-9-]{36}-teacher$/.test(owner) && typeof expires==="number" && expires<=Date.now())await endGuestLibrary(actor.db,owner.slice(6,-8));}
}
export async function endGuestLibrary(db:LibraryActor["db"],roomId:string){
  const ownerId=`guest-${roomId}-teacher`;
  const actor:LibraryActor={db,id:ownerId,ownerId,teacher:true,roomId,guest:true,studentId:`guest-${roomId}-student`,expiresAt:Date.now()};
  const documents=await db.collection("libraryDocuments").where("ownerId","==",ownerId).limit(5).get();
  for(const document of documents.docs)await deleteLibraryDocument(actor,document.id);
  const ref=db.doc(`librarySessions/guest-${roomId}`),pages=await ref.collection("pages").get();
  for(let offset=0;offset<pages.docs.length;offset+=400){const batch=db.batch();for(const page of pages.docs.slice(offset,offset+400))batch.delete(page.ref);await batch.commit();}
  const batch=db.batch();batch.delete(ref);await batch.commit();
}
