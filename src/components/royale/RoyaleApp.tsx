'use client';
import Link from'next/link';import{useEffect,useRef,useState}from'react';import{onAuthStateChanged,type User}from'firebase/auth';import{auth}from'@/lib/firebase';import{readLocalRecord,updateLocalRecord,writeLocalRecord}from'@/lib/blitz/storage';import{royaleRequest}from'@/lib/royale/client';import{starterDeck,validDeck,availableCards,arenas,defaultSettings,type Difficulty,type CardId,type RoyaleSettings}from'@/lib/royale/config';import{normalizeProfile,upgradeProfile,type RoyaleProfile}from'@/lib/royale/progress';import{resumeTiming}from'@/lib/royale/timeline';
import{replayBattle}from'@/lib/royale/engine';
import{balance}from'@/lib/royale/config';
import { lazy, Suspense } from 'react';
import type { GameTask, MatchDescriptor, SavedRun } from './types';
import { RoyaleTeacher } from './RoyaleTeacher';
import { RoyalePreferences, useRoyalePreferences } from './RoyalePreferences';
import { KingdomShell, KingdomHome, KingdomBattleSetup, type KingdomTab } from './KingdomMenu';
import { KingdomDialog } from './KingdomDialog';
import { KingdomProgress } from './KingdomProgress';
import { RoyaleIcon } from './RoyaleIcon';
import { RoyaleSound } from '@/lib/royale/sound';
import s from './Royale.module.css';
import k from './Kingdom.module.css';

const RoyaleCollection=lazy(()=>import('./RoyaleCollection').then(module=>({default:module.RoyaleCollection})));
const RoyaleGame=lazy(()=>import('./RoyaleGame').then(module=>({default:module.RoyaleGame})));
const KingdomStats=lazy(()=>import('./KingdomStats').then(module=>({default:module.KingdomStats})));
type Catalog={questions:GameTask[];topics:string[];version:string};type Account={role:'teacher'|'student';profile:RoyaleProfile;settings:RoyaleSettings};
export function RoyaleApp({teacher=false}:{teacher?:boolean}){const[user,setUser]=useState<User|null|undefined>(),[practice,setPractice]=useState(false);useEffect(()=>onAuthStateChanged(auth,u=>setUser(u)),[]);if(user===undefined)return<main className={s.loading} role="status">Открываем Physics Royale…</main>;if(teacher)return<RoyaleTeacher key={user?.uid||'guest'} user={user}/>;return<AccountRoyale key={`${user?.uid||'guest'}:${practice}`} user={user} practice={!user||practice} onPractice={()=>setPractice(true)} onCloud={()=>setPractice(false)}/>;}
function AccountRoyale({user,practice,onPractice,onCloud}:{user:User|null;practice:boolean;onPractice:()=>void;onCloud:()=>void}){
 const [catalog,setCatalog]=useState<Catalog|null>(null),[profile,setProfile]=useState<RoyaleProfile|null>(null),[settings,setSettings]=useState<RoyaleSettings>(defaultSettings),[error,setError]=useState(''),[busy,setBusy]=useState(false),[tab,setTab]=useState<KingdomTab>('home'),[settingsOpen,setSettingsOpen]=useState(false),[editDeck,setEditDeck]=useState(false),[difficulty,setDifficulty]=useState<Difficulty>('novice'),[arena,setArena]=useState('academy'),[run,setRun]=useState<{match:MatchDescriptor;draft:SavedRun|null}|null>(null),[saved,setSaved]=useState<SavedRun|null>(null),[active,setActive]=useState<MatchDescriptor|null>(null),[notice,setNotice]=useState(''),[deck,setDeck]=useState<CardId[]>([...starterDeck]);
 const {preferences,update:updatePreferences,ready:preferencesReady}=useRoyalePreferences();
 const [checkedAt,setCheckedAt]=useState(()=>Date.now());useEffect(()=>{const timer=setInterval(()=>setCheckedAt(Date.now()),30000);return()=>clearInterval(timer);},[]);
 const menuAudio=useRef<RoyaleSound|null>(null);
 useEffect(()=>{
  const audio=new RoyaleSound();
  menuAudio.current=audio;
  return()=>{menuAudio.current=null;audio.dispose();};
 },[]);
 useEffect(()=>{
  const audio=menuAudio.current;
  if(!audio)return;
  audio.muted=!preferences.sound;
  audio.volume=preferences.volume;
  audio.music=preferences.music;
  if(run||!preferences.sound||!preferences.music)audio.stopMusic();
 },[preferences,run]);
 const operations=useRef(new Map<string,string>());
 const accountKey=practice?`practice:${user?.uid||'guest'}`:user!.uid,storageKey=`royale-run:${accountKey}`,profileKey=`royale-profile:${accountKey}`;
 useEffect(()=>{const controller=new AbortController();let alive=true;
  async function load(){try{const [data,draft]=await Promise.all([royaleRequest<Catalog>(null,undefined,'?view=catalog',controller.signal),readLocalRecord<SavedRun|null>(storageKey,null)]);if(!alive)return;setCatalog(data);if(draft?.match?.id&&Array.isArray(draft.commands)&&Number.isInteger(draft.tick)&&Number.isFinite(draft.savedAt)&&draft.commands.length<=400)setSaved(draft);
    if(practice){const local=normalizeProfile(await readLocalRecord<Partial<RoyaleProfile>>(profileKey,{}));if(alive){setProfile(local);setDeck(local.deck);}}
    else{const [account,ongoing]=await Promise.all([royaleRequest<Account>(user,undefined,'',controller.signal),royaleRequest<{active:MatchDescriptor|null}>(user,undefined,'?view=active',controller.signal)]);if(alive){setProfile(account.profile);setDeck(account.profile.deck);setSettings(account.settings);setActive(ongoing.active);if(account.settings.studentDifficulty[user!.uid])setDifficulty(account.settings.studentDifficulty[user!.uid]);}}
   }catch(problem){if(alive&&!controller.signal.aborted)setError(problem instanceof Error?problem.message:'Не удалось открыть игру.');}}
  void load();return()=>{alive=false;controller.abort();};
 },[practice,profileKey,storageKey,user]);
 async function start(){if(!profile||busy)return;setBusy(true);setError('');try{let match:MatchDescriptor;if(!validDeck(profile.deck))throw Error('Сначала сохраните полную колоду.');if(practice){const selected=arenas.find(a=>a.id===arena)!;if(profile.trophies<selected.trophies)throw Error('Для этой арены пока не хватает кубков.');match={id:crypto.randomUUID(),seed:crypto.getRandomValues(new Uint32Array(1))[0]||1,difficulty,deck:profile.deck,levels:profile.levels,arena,startedAt:Date.now(),focusScale:settings.focusScale,topics:[],section:selected.topic,practice:true,version:balance.version};}
   else{const response=await royaleRequest<{match:Omit<MatchDescriptor,'practice'>}>(user,{action:'start',arena,difficulty});match={...response.match,practice:false};setActive(match);}
   const draft:SavedRun={match,commands:[],tick:0,savedAt:Date.now(),focusActive:false,focusRemaining:120,questionFocus:0,used:[],answers:[],task:null,feedback:null,typedAnswer:''};await writeLocalRecord(storageKey,draft);setSaved(draft);setRun({match,draft:null});
  }catch(problem){setError(problem instanceof Error?problem.message:'Не удалось начать бой.');if(!practice)try{setActive((await royaleRequest<{active:MatchDescriptor|null}>(user,undefined,'?view=active')).active);}catch{/* Preserve original error. */}}finally{setBusy(false);}}
 async function closeActive(){if(!active||!confirm('Закрыть незавершённый матч без наград?'))return;setBusy(true);try{await royaleRequest(user,{action:'abandon',matchId:active.id});await writeLocalRecord(storageKey,null);setActive(null);setSaved(null);setNotice('Незавершённый матч закрыт без начислений.');}catch(problem){setError(problem instanceof Error?problem.message:'Не удалось закрыть матч.');}finally{setBusy(false);}}
 async function collection(action:'upgrade'|'deck',card?:CardId){if(!profile||busy)return;if(action==='deck'&&(!validDeck(deck)||!deck.every(id=>availableCards(profile.xp).includes(id)))){setError('Выберите восемь разных открытых карт.');return;}setBusy(true);setError('');try{let next:RoyaleProfile;const operationKey=`upgrade:${card}`;if(action==='upgrade'&&!operations.current.has(operationKey))operations.current.set(operationKey,crypto.randomUUID());if(practice){next=await updateLocalRecord<RoyaleProfile>(profileKey,current=>{const data=normalizeProfile(current);return action==='upgrade'?upgradeProfile(data,card!):{...data,deck:[...deck]};});}else next=(await royaleRequest<{profile:RoyaleProfile}>(user,{action,card,deck,operationId:operations.current.get(operationKey)})).profile;operations.current.delete(operationKey);setProfile(next);if(action==='deck')setDeck(next.deck);setNotice(action==='upgrade'?'Карта улучшена. Бонус характеристик — 4% за уровень.':'Колода сохранена. Первые четыре карты будут в стартовой руке.');}catch(problem){setError(problem instanceof Error?problem.message:'Не удалось сохранить коллекцию.');}finally{setBusy(false);}}
 function returnMenu(tab:'home'|'stats'|'progress'='home'){setRun(null);setTab(tab);setEditDeck(false);setActive(null);void readLocalRecord<SavedRun|null>(storageKey,null).then(setSaved);if(!practice)void royaleRequest<{active:MatchDescriptor|null}>(user,undefined,'?view=active').then(result=>setActive(result.active)).catch(()=>undefined);}
 if(run&&profile&&catalog)return<Suspense fallback={<main className={k.arenaLoading} role="status"><RoyaleIcon name="swords"/><span>Открываем 3D-арену…</span></main>}><RoyaleGame preferences={preferences} updatePreferences={updatePreferences} key={run.match.id} user={user} match={run.match} draft={run.draft} catalog={catalog.questions} settings={settings} profile={profile} storageKey={storageKey} profileKey={profileKey} onProfile={setProfile} onReturn={returnMenu} onRematch={()=>{setRun(null);void start();}} onDeck={()=>{returnMenu();setEditDeck(true);setTab('collection');}}/></Suspense>;
 const activeValid=active&&(!active.expiresAt||active.expiresAt>checkedAt)&&(!active.version||active.version===balance.version)&&(!active.bankVersion||active.bankVersion===catalog?.version);const canResume=saved&&((practice&&saved.match.practice&&saved.match.version===balance.version)||(!practice&&activeValid&&active?.id===saved.match.id));

 function navigate(next:KingdomTab){
  const audio=menuAudio.current;
  void audio?.interfaceCue('menu');
  if(preferences.sound&&preferences.music>0)audio?.startMusic();
  setEditDeck(false);setTab(next);
 }
 function resume(){
  if(!saved)return;
  try{
   resumeTiming(saved,saved.match.focusScale,Date.now());
   replayBattle(saved.match.seed,saved.match.difficulty,saved.match.deck,saved.match.levels,saved.commands,saved.tick);
   setRun({match:saved.match,draft:saved});
  }catch{setSaved(null);setError('Локальная запись повреждена. Закройте незавершённый матч.');}
 }
 const action=canResume?<div className={k.actions}>
  <button className={k.goldButton} disabled={busy} onClick={resume}>Продолжить бой <RoyaleIcon name="swords"/></button>
  {!practice&&<button disabled={busy} onClick={()=>void closeActive()}>Закрыть бой</button>}
 </div>:active?<div className={k.actions}>
  <p>На аккаунте есть незавершённый матч.</p><button disabled={busy} onClick={()=>void closeActive()}>Закрыть незавершённый бой</button>
 </div>:<button className={k.goldButton} disabled={busy||!catalog||!preferencesReady} onClick={()=>void start()}>{busy?'Готовим арену…':'В бой'} <RoyaleIcon name="swords"/></button>;
 return <KingdomShell tab={tab} profile={profile} name={user?.displayName} practice={practice} onNavigate={navigate} onSettings={()=>setSettingsOpen(true)}>
  {error&&<p className={k.alert} role="alert">{error}</p>}
  {notice&&<div className={k.notice} role="status">{notice}<button aria-label="Скрыть сообщение" onClick={()=>setNotice('')}>×</button></div>}
  {!profile&&!error&&<p className={k.notice} role="status">Открываем профиль и банк задач…</p>}
  {!practice&&!profile&&error&&<button className={k.subButton} onClick={onPractice}>Открыть локальную практику</button>}
  {profile&&tab==='home'&&<KingdomHome profile={profile} topics={catalog?.topics??[]} preferences={preferences} ready={preferencesReady} launching={busy} action={action} showSettings={()=>navigate('battle')}/>}
  {profile&&tab==='battle'&&<KingdomBattleSetup profile={profile} arena={arena} setArena={setArena} difficulty={difficulty} setDifficulty={setDifficulty}
   fixed={Boolean(!practice&&settings.studentDifficulty[user?.uid||''])} preferences={preferences} updatePreferences={updatePreferences}
   action={action} onDeck={()=>{setEditDeck(true);setTab('collection');}}/>}
  {profile&&tab==='collection'&&<Suspense fallback={<p className={k.notice} role="status">Открываем коллекцию…</p>}><RoyaleCollection profile={profile} deck={deck} setDeck={setDeck} busy={busy} save={()=>void collection('deck')}
   upgrade={id=>void collection('upgrade',id)} quality={preferences.quality} initialDeck={editDeck}/></Suspense>}
  {profile&&tab==='progress'&&<KingdomProgress quality={preferences.quality} profile={profile} topics={catalog?.topics??[]} onBattle={()=>navigate('battle')}/>}
  {profile&&tab==='stats'&&<Suspense fallback={<p role="status" className={k.notice}>Открываем статистику…</p>}><KingdomStats profile={profile} topics={catalog?.topics??[]}
   catalog={catalog?.questions??[]} user={practice?null:user}/></Suspense>}
  {settingsOpen&&<KingdomDialog title="Настройки Physics Royale" onClose={()=>setSettingsOpen(false)} kind="settings">
   <header className={k.dialogHead}><h2>Настройки</h2><button className={k.iconButton} onClick={()=>setSettingsOpen(false)} aria-label="Закрыть настройки">×</button></header>
   <RoyalePreferences preferences={preferences} update={updatePreferences}/>
   {practice&&user&&<button type="button" className={k.subButton} onClick={onCloud}>Вернуться к облачному профилю</button>}
   {practice&&!user&&<Link className={k.subButton} href="/#login">Войти в аккаунт</Link>}
   <Link className={k.subButton} href="/teacher/royale">Задачи · преподавателю</Link>
  </KingdomDialog>}
 </KingdomShell>;
}
