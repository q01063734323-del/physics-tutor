import { libraryActor, requireTeacher, linkedStudent, grantId, LibraryError } from "@/lib/library/access";
import { annotatedPdf, documentBytes, ownedDocument, readableDocument, readAnnotations, readPresentation, sessionId, storeDocument } from "@/lib/library/server";
import { libraryFolders, libraryLimits, libraryName, isLibraryId, type LibraryFolder } from "@/lib/library/model";
import { canonicalStroke, isClassroomStroke } from "@/lib/classroom";
const privateHeaders={"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"};
const reply=(data:object,status=200)=>Response.json(data,{status,headers:privateHeaders});
function failure(error:unknown){return reply({error:error instanceof LibraryError?error.message:"Библиотека временно недоступна. Файл не опубликован."},error instanceof LibraryError?error.status:503);}
async function body(request:Request,max:number){const reader=request.body?.getReader();if(!reader)throw new LibraryError("Нет данных.");const parts:Uint8Array[]=[];let size=0;for(;;){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>max){await reader.cancel();throw new LibraryError("Слишком большой запрос.",413);}parts.push(value);}return Buffer.concat(parts);}
async function folders(actor:Awaited<ReturnType<typeof libraryActor>>){
  const saved=await actor.db.collection("libraryFolders").where("ownerId","==",actor.ownerId).limit(100).get();
  const map=new Map<string,LibraryFolder & {deleted?:boolean}>(libraryFolders.map(([id,name])=>[id,{id,name}]));for(const item of saved.docs)map.set(item.get("folderId"),{id:item.get("folderId"),name:item.get("name"),deleted:item.get("deleted")===true});return [...map.values()].filter(item=>!item.deleted);
}
export async function GET(request:Request){try{
  const actor=await libraryActor(request);const params=new URL(request.url).searchParams;
  if(params.has("file")){
    const doc=await readableDocument(actor,params.get("file"));const bytes=await documentBytes(actor,doc);
    return new Response(new Uint8Array(bytes),{headers:{...privateHeaders,"Content-Type":"application/pdf","Content-Length":String(bytes.length),"Content-Disposition":`${params.has("download")?"attachment":"inline"}; filename="lesson.pdf"; filename*=UTF-8''${encodeURIComponent(doc.name)}`}});
  }
  if(params.get("view")==="session"){
    const state=await readPresentation(actor);if(state.documentId){const document=await readableDocument(actor,state.documentId).catch(()=>null);if(document){const annotations=await readAnnotations(actor,state.sessionId,document.id,state.page);return reply({state:{...state,annotations:{[state.page]:annotations}},document});}}
    return reply({state:{...state,active:false},document:null});
  }
  if(params.get("view")==="history"){
    requireTeacher(actor);if(!actor.roomId || actor.guest)return reply({sessions:[]});
    const records=await actor.db.collection("librarySessions").where("ownerId","==",actor.ownerId).limit(100).get();
    return reply({sessions:records.docs.filter(doc=>doc.id!==sessionId(actor) && doc.get("studentId")===actor.studentId && doc.get("documentId")).map(doc=>({id:doc.id,documentId:doc.get("documentId"),page:doc.get("page"),updatedAt:doc.get("updatedAt")})).sort((a,b)=>String(b.updatedAt).localeCompare(String(a.updatedAt)))});
  }
  if(actor.teacher){
    const [documents,folderList,grants]=await Promise.all([actor.db.collection("libraryDocuments").where("ownerId","==",actor.ownerId).limit(101).get(),folders(actor),actor.db.collection("libraryGrants").where("ownerId","==",actor.ownerId).limit(500).get()]);
    return reply({role:"teacher",documents:documents.docs.map(doc=>doc.data()).filter(doc=>doc.status==="ready" && (!doc.expiresAt || doc.expiresAt>Date.now())),folders:folderList,grants:grants.docs.map(doc=>({id:doc.id,...doc.data()})),limits:libraryLimits,guest:actor.guest});
  }
  const grants=await actor.db.collection("libraryGrants").where("studentId","==",actor.id).limit(200).get();
  const documents=await Promise.all(grants.docs.filter(doc=>doc.get("active")).map(doc=>ownedDocument(actor,doc.get("documentId")).catch(()=>null)));
  return reply({role:"student",documents:documents.filter(Boolean),folders:[],grants:[],limits:libraryLimits});
}catch(error){return failure(error);}}
export async function POST(request:Request){try{
  if(request.headers.get("sec-fetch-site")==="cross-site")throw new LibraryError("Запрос отклонён.",403);
  const actor=await libraryActor(request);requireTeacher(actor);
  if(request.headers.get("content-type")?.split(";")[0]==="application/pdf"){
    const name=libraryName(decodeURIComponent(request.headers.get("x-file-name")||""));if(!name || !/\.pdf$/i.test(name))throw new LibraryError("Выберите PDF.");
    const folderId=request.headers.get("x-folder-id")||"extra";if(!(await folders(actor)).some(folder=>folder.id===folderId))throw new LibraryError("Папка недоступна.");
    return reply({document:await storeDocument(actor,await body(request,libraryLimits.fileBytes),name,folderId)});
  }
  let input:Record<string,unknown>;try{input=JSON.parse((await body(request,750000)).toString());}catch(error){if(error instanceof LibraryError)throw error;throw new LibraryError("Некорректные данные.");}
  if(!input || typeof input!=="object" || Array.isArray(input))throw new LibraryError("Ожидается объект.");
  if(input.action==="folder"){
    const name=libraryName(input.name),id=input.id || crypto.randomUUID();if(!name || !isLibraryId(id))throw new LibraryError("Введите название папки.");
    const list=await folders(actor);if(!input.id && list.length>=50)throw new LibraryError("Лимит: 50 папок.");
    await actor.db.doc(`libraryFolders/${actor.ownerId}_${id}`).set({ownerId:actor.ownerId,folderId:id,name,deleted:false});return reply({saved:true});
  }
  if(input.action==="delete-folder"){
    if(!isLibraryId(input.id) || input.id==="extra")throw new LibraryError("Папку «Дополнительные материалы» нельзя удалить.");
    const records=await actor.db.collection("libraryDocuments").where("ownerId","==",actor.ownerId).get();const batch=actor.db.batch();
    records.docs.filter(doc=>doc.get("folderId")===input.id).forEach(doc=>batch.update(doc.ref,{folderId:"extra"}));
    batch.set(actor.db.doc(`libraryFolders/${actor.ownerId}_${input.id}`),{ownerId:actor.ownerId,folderId:input.id,name:"",deleted:true});await batch.commit();return reply({saved:true});
  }
  if(["start","page","close","annotations","resume"].includes(String(input.action))){
    const id=sessionId(actor),ref=actor.db.doc(`librarySessions/${id}`);
    if(input.action==="start"){
      const document=await ownedDocument(actor,input.documentId);if(document.ownerId!==actor.ownerId)throw new LibraryError("Нет доступа.",403);
      const previous=await ref.get();await ref.set({ownerId:actor.ownerId,studentId:actor.studentId,documentId:document.id,page:1,active:true,revision:(previous.get("revision")||0)+1,updatedAt:new Date().toISOString(),lessonDate:new Date().toISOString(),annotationBytes:previous.get("annotationBytes")||0},{merge:true});return reply({saved:true});
    }
    if(input.action==="resume"){
      if(!isLibraryId(input.fromSession) || input.fromSession===id)throw new LibraryError("Некорректный прошлый урок.");
      const source=await actor.db.doc(`librarySessions/${input.fromSession}`).get();
      if(actor.guest || source.get("ownerId")!==actor.ownerId || source.get("studentId")!==actor.studentId)throw new LibraryError("Урок другого ученика недоступен.",403);
      const document=await ownedDocument(actor,source.get("documentId"));if(document.ownerId!==actor.ownerId)throw new LibraryError("Нет доступа.",403);
      const baseDepth=Number(source.get("baseDepth")||0)+1;if(baseDepth>5)throw new LibraryError("Слишком длинная цепочка восстановления. Откройте исходный материал и сохраните PDF с пометками.");
      await ref.set({ownerId:actor.ownerId,studentId:actor.studentId,documentId:document.id,page:source.get("page")||1,active:true,revision:1,baseSessionId:input.fromSession,baseDepth,annotationBytes:source.get("annotationBytes")||0,updatedAt:new Date().toISOString(),lessonDate:new Date().toISOString()});return reply({saved:true});
    }
    await actor.db.runTransaction(async tx=>{
      const snapshot=await tx.get(ref);if(snapshot.get("ownerId")!==actor.ownerId || snapshot.get("studentId")!==actor.studentId)throw new LibraryError("Презентация не открыта.",403);
      const document=await tx.get(actor.db.doc(`libraryDocuments/${snapshot.get("documentId")}`));if(document.get("status")!=="ready")throw new LibraryError("Файл удалён.",404);
      if(input.action==="close"){tx.update(ref,{active:false,revision:(snapshot.get("revision")||0)+1,updatedAt:new Date().toISOString()});return;}
      if(typeof input.page!=="number" || !Number.isInteger(input.page) || input.page<1 || input.page>document.get("pages"))throw new LibraryError("Нет такой страницы.");
      if(input.action==="page"){tx.update(ref,{page:input.page,revision:(snapshot.get("revision")||0)+1,updatedAt:new Date().toISOString()});return;}
      if(input.documentId!==snapshot.get("documentId") || !Array.isArray(input.strokes) || input.strokes.length>libraryLimits.strokes || !input.strokes.every(isClassroomStroke))throw new LibraryError("Некорректные пометки.");
      const pageRef=ref.collection("pages").doc(`${input.documentId}_${input.page}`),old=await tx.get(pageRef);const size=Buffer.byteLength(JSON.stringify(input.strokes));const total=(snapshot.get("annotationBytes")||0)-(old.get("bytes")||0)+size;if(total>4*1024*1024)throw new LibraryError("Пометки урока достигли 4 МБ. Сохраните PDF и начните новый урок.");
      tx.set(pageRef,{strokes:input.strokes.map(stroke=>canonicalStroke(stroke,actor.id)),bytes:size});tx.update(ref,{annotationBytes:total,revision:(snapshot.get("revision")||0)+1,updatedAt:new Date().toISOString()});
    });return reply({saved:true});
  }
  const document=await ownedDocument(actor,input.documentId);if(document.ownerId!==actor.ownerId)throw new LibraryError("Это материал другого преподавателя.",403);
  if(input.action==="rename"){
    const name=libraryName(input.name);if(!name)throw new LibraryError("Введите название.");const folderId=typeof input.folderId==="string"?input.folderId:document.folderId;if(!(await folders(actor)).some(folder=>folder.id===folderId))throw new LibraryError("Папка недоступна.");
    await actor.db.doc(`libraryDocuments/${document.id}`).update({name,folderId});return reply({saved:true});
  }
  if(input.action==="delete"){
    const ref=actor.db.doc(`libraryDocuments/${document.id}`),quota=actor.db.doc(`libraryAccounts/${actor.ownerId}`);
    await actor.db.runTransaction(async tx=>{const [current,used]=await Promise.all([tx.get(ref),tx.get(quota)]);if(current.get("status")!=="ready")return;tx.update(ref,{status:"deleted"});tx.set(quota,{bytes:Math.max(0,(used.get("bytes")||0)-document.bytes),count:Math.max(0,(used.get("count")||0)-1)});});
    const [chunks,grants]=await Promise.all([ref.collection("chunks").get(),actor.db.collection("libraryGrants").where("documentId","==",document.id).get()]);const batch=actor.db.batch();chunks.docs.forEach(doc=>batch.delete(doc.ref));grants.docs.forEach(doc=>batch.delete(doc.ref));await batch.commit();return reply({saved:true});
  }
  if(input.action==="share" || input.action==="revoke"){
    const studentId=input.action==="revoke" && isLibraryId(input.studentId)?input.studentId:await linkedStudent(actor,input.studentId);let shared=document;
    if(input.action==="share" && input.annotated===true){const bytes=await annotatedPdf(actor,document,sessionId(actor));shared=await storeDocument(actor,bytes,document.name.replace(/\.pdf$/i,"")+" — с пометками.pdf",document.folderId,document.id);}
    await actor.db.doc(`libraryGrants/${grantId(shared.id,studentId)}`).set({ownerId:actor.ownerId,documentId:shared.id,studentId,active:input.action==="share",kind:shared.kind,updatedAt:new Date().toISOString()});return reply({saved:true,document:shared});
  }
  if(input.action==="export"){
    const bytes=await annotatedPdf(actor,document,sessionId(actor));return new Response(new Uint8Array(bytes),{headers:{...privateHeaders,"Content-Type":"application/pdf","Content-Disposition":"attachment; filename=annotated-lesson.pdf"}});
  }
  throw new LibraryError("Неизвестное действие.");
}catch(error){return failure(error);}}
