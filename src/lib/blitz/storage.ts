import { emptyStudyState, type StudyState } from "./engine";

const DB_NAME = "physics-tutor-learning";
let database: Promise<IDBDatabase> | undefined;
function openDatabase(): Promise<IDBDatabase> {
  database ??= new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore("accounts");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => { database = undefined; reject(request.error); };
    request.onblocked = () => { database = undefined; reject(new Error("Закрой старые вкладки тренажёра и повтори сохранение.")); };
  });
  return database;
}

export async function readLocalRecord<T>(key: string, fallback: T): Promise<T> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const request = db.transaction("accounts", "readonly").objectStore("accounts").get(key);
    request.onsuccess = () => resolve(request.result ?? fallback);
    request.onerror = () => reject(request.error);
  });
}

export async function writeLocalRecord(key: string, value: unknown): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("accounts", "readwrite");
    tx.objectStore("accounts").put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error("Не удалось сохранить результат на устройстве."));
  });
}

export async function loadStudyState(account: string): Promise<StudyState> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const request = db.transaction("accounts", "readonly").objectStore("accounts").get(`blitz-v2:${account}`);
    request.onsuccess = () => {
      const state = request.result as StudyState | undefined;
      resolve(state?.schemaVersion === 2 && Array.isArray(state.events) && Array.isArray(state.pending) && Array.isArray(state.history) ? state : emptyStudyState());
    };
    request.onerror = () => reject(request.error);
  });
}

export async function saveStudyState(account: string, state: StudyState): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("accounts", "readwrite");
    tx.objectStore("accounts").put(state, `blitz-v2:${account}`);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error("Сохранение прервано. Результат остаётся на экране."));
  });
}

/** Read and update a single local account record in the same transaction. */
export async function updateLocalRecord<T>(key: string, update: (value: T | undefined) => T): Promise<T> {
 const db=await openDatabase();
 return new Promise((resolve,reject)=>{
  const tx=db.transaction('accounts','readwrite'),store=tx.objectStore('accounts');
  const read=store.get(key);
  let next:T;
  read.onsuccess=()=>{
   try{next=update(read.result);store.put(next,key);}
   catch(error){tx.abort();reject(error);}
  };
  tx.oncomplete=()=>resolve(next);
  tx.onerror=()=>reject(tx.error);
  tx.onabort=()=>reject(tx.error??Error('Сохранение прервано.'));
 });
}
