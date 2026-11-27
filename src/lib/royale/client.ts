import type{User}from'firebase/auth';import{auth}from'../firebase';
export async function royaleRequest<T>(user:User|null,body?:object,query='',signal?:AbortSignal):Promise<T>{
 const headers:Record<string,string>={};if(user){if(auth.currentUser?.uid!==user.uid)throw Error('Аккаунт изменился. Откройте игру заново.');headers.Authorization=`Bearer ${await user.getIdToken()}`;}
 const controller=new AbortController(),abort=()=>controller.abort();signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted)controller.abort();const timeout=setTimeout(abort,30000);
 try{if(body)headers['Content-Type']='application/json';const response=await fetch('/api/royale'+query,{method:body?'POST':'GET',headers,cache:'no-store',signal:controller.signal,body:body?JSON.stringify(body):undefined}).catch(error=>{
   if(error instanceof TypeError)throw Error('Нет соединения с сервером. Проверьте подключение и повторите.');
   throw error;
 });let data;try{data=await response.json();}catch{throw Error('Сервер временно не отвечает. Дождитесь соединения и повторите.');}if(!response.ok)throw Error(data.error||'Не удалось выполнить действие.');return data as T;
 }catch(error){if(controller.signal.aborted&&!signal?.aborted)throw Error('Сервер не ответил вовремя. Дождитесь соединения и повторите отправку.');throw error;}finally{clearTimeout(timeout);signal?.removeEventListener('abort',abort);}
}
