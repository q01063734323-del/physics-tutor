import type { User } from "firebase/auth";
import { auth } from "../firebase";
export type LibraryContext={user?:User|null;roomId?:string;guestAccess?:string};
export async function libraryHeaders(context:LibraryContext){
  const headers:Record<string,string>={};
  if(context.roomId)headers["x-classroom-room"]=context.roomId;
  if(context.guestAccess)headers["x-classroom-guest"]=context.guestAccess;
  else{const user=context.user===undefined?auth.currentUser:context.user;if(!user || auth.currentUser?.uid!==user.uid)throw Error("Войдите в аккаунт.");headers.Authorization=`Bearer ${await user.getIdToken()}`;}
  return headers;
}
export async function libraryRequest<T>(context:LibraryContext,query="",input?:object,signal?:AbortSignal):Promise<T>{
  const response=await fetch(`/api/library${query}`,{method:input?"POST":"GET",cache:"no-store",signal,headers:{...await libraryHeaders(context),...(input?{"Content-Type":"application/json"}:{})},body:input?JSON.stringify(input):undefined});
  const data=await response.json();if(!response.ok)throw Error(data.error||"Материал недоступен.");return data;
}
export async function fetchPdf(context:LibraryContext,id:string,signal?:AbortSignal){
  const response=await fetch(`/api/library?file=${encodeURIComponent(id)}`,{cache:"no-store",signal,headers:await libraryHeaders(context)});
  if(!response.ok){const data=await response.json();throw Error(data.error||"Не удалось открыть PDF.");}return new Uint8Array(await response.arrayBuffer());
}
export function downloadPdf(bytes:Uint8Array,name:string){const url=URL.createObjectURL(new Blob([new Uint8Array(bytes)],{type:"application/pdf"}));const link=document.createElement("a");link.href=url;link.download=name;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
