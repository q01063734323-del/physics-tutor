import type { ClassroomStroke } from "../classroom";
export const libraryFolders = [
  ["mechanics", "Механика"], ["thermodynamics", "Молекулярная физика и термодинамика"],
  ["electricity", "Электродинамика"], ["waves", "Колебания и волны"], ["optics", "Оптика"],
  ["quantum", "Квантовая физика"], ["ege", "Подготовка к ЕГЭ"], ["extra", "Дополнительные материалы"],
] as const;
export const libraryLimits = { fileBytes: 8 * 1024 * 1024, totalBytes: 64 * 1024 * 1024, pages: 300, documents: 100, chunkBytes: 512 * 1024, strokes: 160, points: 240 };
export type LibraryDocument = { id:string; ownerId:string; name:string; folderId:string; bytes:number; pages:number; createdAt:string; status:"ready"|"deleted"; kind:"original"|"annotated"; derivedFrom?:string; expiresAt?:number };
export type LibraryFolder = { id:string; name:string };
export type PresentationState = { active:boolean; documentId:string|null; page:number; revision:number; annotations:Record<string,ClassroomStroke[]>; updatedAt:string; lessonDate:string; studentId:string };
export const emptyPresentation:PresentationState = {active:false,documentId:null,page:1,revision:0,annotations:{},updatedAt:"",lessonDate:"",studentId:""};
export const isLibraryId = (value:unknown):value is string => typeof value==="string" && /^[a-zA-Z0-9_-]{1,128}$/.test(value);
export function libraryName(value:unknown) { return typeof value==="string" ? value.trim().replace(/[\u0000-\u001f/\\]/g," ").slice(0,160) : ""; }
export function validLibraryFile(name:string,type:string,size:number) { return /\.pdf$/i.test(name) && type.split(";")[0]==="application/pdf" && size>0 && size<=libraryLimits.fileBytes; }
export function sortLibrary(documents:LibraryDocument[],sort:string,search:string,folder:string) {
  return documents.filter(doc=>doc.status==="ready" && (!folder || doc.folderId===folder) && doc.name.toLocaleLowerCase("ru").includes(search.toLocaleLowerCase("ru")))
    .sort((a,b)=>sort==="name"?a.name.localeCompare(b.name,"ru"):sort==="type"?a.kind.localeCompare(b.kind)||a.name.localeCompare(b.name,"ru"):b.createdAt.localeCompare(a.createdAt));
}
