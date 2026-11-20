import { readLocalRecord,writeLocalRecord } from "../blitz/storage";
type Command={id:string;body:Record<string,unknown>};
const writes=new Map<string,Promise<unknown>>(),flights=new Map<string,Promise<number>>();
function serial<T>(key:string,operation:()=>Promise<T>):Promise<T>{const next=(writes.get(key)||Promise.resolve()).catch(()=>undefined).then(operation);writes.set(key,next);void next.finally(()=>{if(writes.get(key)===next)writes.delete(key);}).catch(()=>undefined);return next;}
export async function readBoardCommands(key:string){return serial(key,()=>readLocalRecord<Command[]>(key,[]));}
export async function queueBoardCommand(key:string,body:Record<string,unknown>){const command={id:crypto.randomUUID(),body};await serial(key,async()=>{const saved=await readLocalRecord<Command[]>(key,[]);if(saved.length>=400)throw Error("Очередь доски заполнена. Сначала восстановите соединение.");await writeLocalRecord(key,[...saved,command]);});}
export function flushBoardCommands(key:string,send:(body:Record<string,unknown>)=>Promise<unknown>):Promise<number>{
 const running=flights.get(key);if(running)return running;
 const result=(async()=>{let failed=false;for(;;){const records=await readBoardCommands(key);if(!records.length || failed || (typeof navigator!=="undefined"&&!navigator.onLine))return records.length;for(const command of records){try{await send(command.body);await serial(key,async()=>{const latest=await readLocalRecord<Command[]>(key,[]);await writeLocalRecord(key,latest.filter(item=>item.id!==command.id));});}catch{failed=true;break;}}}})();
 flights.set(key,result);void result.finally(()=>{if(flights.get(key)===result)flights.delete(key);}).catch(()=>undefined);return result;
}
