/* eslint-disable @next/next/no-img-element -- Original local game art. */
'use client';
import{useCallback,useEffect,useRef,useState,type PointerEvent}from'react';import type{User}from'firebase/auth';
import{resumeTiming}from'@/lib/royale/timeline';
import{balance,cards,arenas,type CardId,type RoyaleSettings,type Tier}from'@/lib/royale/config';import{createBattle,applyCommand,advanceBattle,replayBattle,canPlace,stepBattle,type GameCommand}from'@/lib/royale/engine';
import{royaleRequest}from'@/lib/royale/client';import{rewardMatch,type RoyaleProfile,type VerifiedAnswer}from'@/lib/royale/progress';import{writeLocalRecord}from'@/lib/blitz/storage';import{create2DView}from'@/lib/royale/view-2d';import type{BattleView,GraphicsMode}from'@/lib/royale/presentation';import{RoyaleSound}from'@/lib/royale/sound';import type{TrainerCheckResult}from'@/lib/trainer-public';import{StudioDialog}from'../StudioDialog';
import type{GameTask,IssuedTask,MatchDescriptor,SavedRun}from'./types';import s from'./Royale.module.css';import{FrameMeter}from'@/lib/royale/quality';import{PreferenceFields,type Preferences}from'./RoyalePreferences';import{achievementLabels}from'@/lib/royale/progress';
import {CardArtwork} from './CardArtwork';
import { BattleIcon } from './RoyaleBattleIcon';
import { RoyaleTaskPanel } from './RoyaleTaskPanel';
import { BattleEnergyBurst } from './BattleEnergyBurst';
import b from './RoyaleBattle.module.css';
import {MissedQuestions} from './MissedQuestions';
type Finish={profile:RoyaleProfile;outcome:'win'|'loss'|'draw';rewarded:boolean};
type Props={preferences:Preferences;updatePreferences:(patch:Partial<Preferences>)=>void;initialView:GraphicsMode;user:User|null;match:MatchDescriptor;draft:SavedRun|null;catalog:GameTask[];settings:RoyaleSettings;profile:RoyaleProfile;storageKey:string;profileKey:string;onProfile:(profile:RoyaleProfile)=>void;onReturn:()=>void;onRematch:()=>void;onDeck:()=>void};
function bootBattle(match:MatchDescriptor,draft:SavedRun|null,targetTick=0){const state=draft?replayBattle(match.seed,match.difficulty,match.deck,match.levels,draft.commands,draft.tick):createBattle(match.seed,match.difficulty,match.deck,match.levels);if(draft?.forfeit)state.result='loss';if(!state.result&&targetTick>state.tick)advanceBattle(state,targetTick);return state;}
export function RoyaleGame({preferences,updatePreferences,initialView,user,match,draft,catalog,settings,profile,storageKey,profileKey,onProfile,onReturn,onRematch,onDeck}:Props){
 const [baseline]=useState(profile);const paused=useRef(false);const [viewMode,setViewMode]=useState<GraphicsMode>(initialView),[viewLoading,setViewLoading]=useState<number|null>(null),[placementPending,setPlacementPending]=useState(false);const viewRef=useRef<BattleView|null>(null),viewModeRef=useRef(viewMode);useEffect(()=>{viewModeRef.current=viewMode;},[viewMode]);
 const [timing]=useState(()=>draft?resumeTiming(draft,match.focusScale,Date.now()):{tick:0,focusRemaining:balance.focusBudgetSeconds,questionFocus:0});
 const battleRef=useRef<ReturnType<typeof createBattle>|null>(null);if(battleRef.current===null)battleRef.current=bootBattle(match,draft,timing.tick);
 const commands=useRef<GameCommand[]>(draft?.commands||[]),used=useRef<string[]>(draft?.used||[]),answers=useRef<VerifiedAnswer[]>(draft?.answers||[]),focusRemaining=useRef(timing.focusRemaining),questionFocus=useRef(timing.questionFocus),focusActive=useRef(false),taskRef=useRef<IssuedTask|null>(draft?.task||null),feedbackRef=useRef<TrainerCheckResult|null>(draft?.feedback||null),typedRef=useRef(draft?.typedAnswer||''),selectedRef=useRef<CardId|null>(null),pendingStorage=useRef<Promise<unknown>>(Promise.resolve()),forfeit=useRef(Boolean(draft?.forfeit)),finishedOnce=useRef(false),committed=useRef(false),alive=useRef(false),cursor=useRef({x:110,y:450}),canvas=useRef<HTMLCanvasElement>(null),persist=useRef<()=>void>(()=>undefined);
 const preferencesRef=useRef(preferences);useEffect(()=>{preferencesRef.current=preferences;},[preferences]);
 const soundRef=useRef<RoyaleSound|null>(null);if(soundRef.current===null)soundRef.current=new RoyaleSound();const {sound:soundOn,volume,music}=preferences;const [audioOpen,setAudioOpen]=useState(false),[performanceStats,setPerformanceStats]=useState({fps:0,frameMs:0,renderMs:0,low:false,calls:0,triangles:0,geometries:0,textures:0});
 const [hud,setHud]=useState(()=>{const state=bootBattle(match,draft,timing.tick);return{tick:state.tick,energy:state.energy,hand:[...state.hand],result:state.result,slow:false,focus:timing.focusRemaining,questionFocus:timing.questionFocus,catchingUp:false,forfeit:Boolean(draft?.forfeit),scorePlayer:state.towers.filter(t=>t.side==='bot'&&t.hp<=0).length,scoreBot:state.towers.filter(t=>t.side==='player'&&t.hp<=0).length};}),[selected,setSelected]=useState<CardId|null>(null),[panel,setPanel]=useState(false),[confirmQuit,setConfirmQuit]=useState(false),[task,setTask]=useState<IssuedTask|null>(draft?.task||null),[feedback,setFeedback]=useState<TrainerCheckResult|null>(draft?.feedback||null),[input,setInput]=useState(draft?.typedAnswer||''),[taskBusy,setTaskBusy]=useState(false),[message,setMessage]=useState(''),[tier,setTier]=useState<Tier|'all'>('all'),[topic,setTopic]=useState('all'),[section,setSection]=useState('all'),[newOnly,setNewOnly]=useState(false),[earned,setEarned]=useState(0),[finishResult,setFinishResult]=useState<Finish|null>(null),[saving,setSaving]=useState(false),[finishError,setFinishError]=useState('');
 const gameRoot = useRef<HTMLElement>(null);
 const energyRef = useRef<HTMLDivElement>(null);
 const rewardRef = useRef<HTMLDivElement>(null);
 const taskTrigger = useRef<HTMLElement | null>(null);
 const [mobile, setMobile] = useState(false);
 const [statsOpen, setStatsOpen] = useState(false);
 const [fullscreen, setFullscreen] = useState(false);
 const [theater, setTheater] = useState(false);
 const lessonOpen = panel && !hud.result;
 const [answerHistory, setAnswerHistory] = useState<VerifiedAnswer[]>(() => draft?.answers || []);
 const answerSummary = { total: answerHistory.length, correct: answerHistory.filter(answer => answer.correct).length };
 useEffect(() => {
  const query = matchMedia('(max-width: 760px), (max-width: 920px) and (max-height: 530px)');
  const update = () => setMobile(query.matches);
  update();
  query.addEventListener('change', update);
  return () => query.removeEventListener('change', update);
 }, []);
 useEffect(() => {
  const update = () => setFullscreen(Boolean(gameRoot.current && document.fullscreenElement === gameRoot.current));
  document.addEventListener('fullscreenchange', update);
  return () => document.removeEventListener('fullscreenchange', update);
 }, []);
 useEffect(() => {
  const root = gameRoot.current;
  const viewport = window.visualViewport;
  if (!root || !viewport || !mobile || !lessonOpen) return;
  const resize = () => {
   root.style.setProperty('--lesson-height', `${viewport.height}px`);
   root.style.setProperty('--lesson-top', `${viewport.offsetTop}px`);
  };
  resize();
  viewport.addEventListener('resize', resize);
  viewport.addEventListener('scroll', resize);
  return () => {
   viewport.removeEventListener('resize', resize);
   viewport.removeEventListener('scroll', resize);
   root.style.removeProperty('--lesson-height');
   root.style.removeProperty('--lesson-top');
  };
 }, [mobile, lessonOpen]);
 async function toggleFullscreen() {
  if (theater) { setTheater(false); return; }
  if (document.fullscreenElement === gameRoot.current) {
   await document.exitFullscreen();
   return;
  }
  try {
   if (gameRoot.current?.requestFullscreen) {
    await gameRoot.current.requestFullscreen();
    return;
   }
  } catch { /* Use the browser viewport when full screen is unavailable. */ }
  setTheater(true);
 }
 useEffect(() => {
  if (!theater) return;
  const exit = (event: KeyboardEvent) => { if (event.key === 'Escape' && !event.defaultPrevented) setTheater(false); };
  window.addEventListener('keydown', exit);
  return () => window.removeEventListener('keydown', exit);
 }, [theater]);
 useEffect(()=>{if(!message||panel)return;const timer=setTimeout(()=>setMessage(current=>current===message?'':current),5000);return()=>clearTimeout(timer);},[message,panel]);
 const arena=arenas.find(a=>a.id===match.arena)||arenas[0];
 const snapshot=useCallback(():SavedRun=>({match,commands:[...commands.current],tick:battleRef.current!.tick,savedAt:Date.now(),focusActive:focusActive.current,focusRemaining:focusRemaining.current,questionFocus:questionFocus.current,used:[...used.current],answers:[...answers.current],task:taskRef.current,feedback:feedbackRef.current,typedAnswer:typedRef.current,forfeit:forfeit.current}),[match]);
 const store=useCallback(()=>{if(committed.current)return Promise.resolve();const record=snapshot();const next=pendingStorage.current.catch(()=>undefined).then(()=>writeLocalRecord(storageKey,record));pendingStorage.current=next;void next.catch(()=>{if(alive.current)setMessage('Локальное сохранение недоступно. Не закрывайте вкладку до сохранения результата.');});return next;},[snapshot,storageKey]);
 useEffect(()=>{persist.current=()=>{void store();};},[store]);
 useEffect(()=>{const sound=soundRef.current!;sound.muted=!soundOn;sound.volume=volume;sound.music=music;if(soundOn){sound.unlock();if(music>0)sound.startMusic();else sound.stopMusic();}else sound.stopMusic();},[soundOn,volume,music]);
 useEffect(()=>{const element=canvas.current;if(!element)return;let cancelled=false,created:BattleView|null=null;let observer:ResizeObserver|null=null;
  const report=(text:string)=>{if(!cancelled){setMessage(text);if(text.includes('WebGL')){setViewMode('2d');updatePreferences({graphics:'2d'});}}};
  const connect=(view:BattleView)=>{if(cancelled){view.dispose();return;}created=view;viewRef.current=view;const resize=()=>{const r=element.getBoundingClientRect();view.resize(r.width,r.height,Math.min(devicePixelRatio||1,preferencesRef.current.quality==='low'?1:2));};resize();observer=new ResizeObserver(resize);observer.observe(element);if(viewMode==='2d')setViewLoading(null);};
  if(viewMode==='3d'&&preferencesRef.current.quality!=='low')queueMicrotask(()=>{if(!cancelled)setViewLoading(0);});
  if(viewMode==='2d'){try{connect(create2DView(element,match.arena,report));}catch(error){report(error instanceof Error?error.message:'Не удалось открыть классическую арену.');}}
  else void import('@/lib/royale/three/renderer').then(module=>{if(!cancelled)connect(module.create3DView(element,match.arena,report,(ready,total)=>{
    if(!cancelled)setViewLoading(ready===total?null:Math.round(ready/total*100));
   },preferencesRef.current.quality==='low'));}).catch(()=>{if(!cancelled){setViewMode('2d');updatePreferences({graphics:'2d'});setMessage('3D недоступен на этом устройстве. Продолжаем тот же бой в 2D.');}});
  return()=>{cancelled=true;observer?.disconnect();if(viewRef.current===created)viewRef.current=null;created?.dispose();};
 // Preference changes are consumed by the view each frame; they must not recreate the scene.
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[viewMode,match.arena]);
 useEffect(()=>{const battle=battleRef.current!,sound=soundRef.current!;alive.current=true;window.scrollTo({top:0,left:0});const previous=new Map<number,{x:number;y:number}>();let frame=0,last=performance.now(),accumulator=0,lastHud=0,lastEffect=0,lastDraw=0,lastMeasure=0,renderCost=0,draws=0,endedAt=0;const meter=new FrameMeter();let qualityMode=preferencesRef.current.quality,qualityLow=qualityMode==='low';const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  const loop=(now:number)=>{if(qualityMode!==preferencesRef.current.quality){qualityMode=preferencesRef.current.quality;qualityLow=qualityMode==='low';meter.reset();}const delta=paused.current?0:Math.max(0,now-last);last=now;let slowed=0;if(focusActive.current&&focusRemaining.current>0&&questionFocus.current<balance.focusPerQuestionSeconds&&!battle.result){slowed=Math.min(delta,focusRemaining.current*1000,(balance.focusPerQuestionSeconds-questionFocus.current)*1000);focusRemaining.current-=slowed/1000;questionFocus.current+=slowed/1000;}accumulator+=slowed*match.focusScale+(delta-slowed);let steps=0;
   while(accumulator>=balance.tickMs&&steps++<32&&!battle.result){previous.clear();for(const unit of battle.units)previous.set(unit.id,{x:unit.x,y:unit.y});stepBattle(battle);accumulator-=balance.tickMs;}
   if(viewRef.current&&(!qualityLow||now-lastDraw>=32||battle.result)){const renderStarted=performance.now();if(lastDraw)meter.push(now-lastDraw);lastDraw=now;try{viewRef.current.render({battle,selected:selectedRef.current,alpha:Math.min(1,accumulator/balance.tickMs),previous,reducedMotion:reduced,cursor:selectedRef.current?cursor.current:undefined,quality:qualityMode,lowQuality:qualityLow});}catch{if(viewModeRef.current==='3d'){setViewMode('2d');setMessage('Графика 3D недоступна. Бой продолжается в классическом режиме.');}}renderCost+=performance.now()-renderStarted;draws++;}
   if(now-lastMeasure>1000){if(qualityMode!=='auto')qualityLow=qualityMode==='low';else if(meter.ready&&!qualityLow&&meter.fps<45)qualityLow=true;setPerformanceStats({fps:meter.fps,frameMs:meter.frameMs,renderMs:draws?renderCost/draws:0,low:qualityLow,...(viewRef.current?.diagnostics?.()||{calls:0,triangles:0,geometries:0,textures:0})});lastMeasure=now;renderCost=0;draws=0;}
   const effect=battle.effects.findLast(e=>e.id>lastEffect);if(effect){lastEffect=effect.id;soundRef.current?.play(effect.kind);if(preferencesRef.current.haptics&&!reduced&&['fire','collapse'].includes(effect.kind)&&document.visibilityState==='visible')navigator.vibrate?.(18);}
   if(now-lastHud>100){setHud({tick:battle.tick,energy:battle.energy,hand:[...battle.hand],result:battle.result,slow:slowed>0&&match.focusScale<1,focus:Math.max(0,focusRemaining.current),questionFocus:questionFocus.current,catchingUp:!battle.result&&accumulator>300,forfeit:forfeit.current,scorePlayer:battle.towers.filter(t=>t.side==='bot'&&t.hp<=0).length,scoreBot:battle.towers.filter(t=>t.side==='player'&&t.hp<=0).length});lastHud=now;}
   if(battle.result&&!endedAt)endedAt=now;if(!endedAt||now-endedAt<1000)frame=requestAnimationFrame(loop);
  };frame=requestAnimationFrame(loop);const save=setInterval(()=>persist.current(),2000),onHide=()=>persist.current();window.addEventListener('pagehide',onHide);
  return()=>{alive.current=false;cancelAnimationFrame(frame);clearInterval(save);window.removeEventListener('pagehide',onHide);sound.dispose();};
 },[match.focusScale]);
 const finalize=useCallback(async()=>{const battle=battleRef.current!;if(saving||finishResult)return;setSaving(true);setFinishError('');focusActive.current=false;
  try{await store();let result:Finish;if(match.practice){const rated=!forfeit.current&&answers.current.some(a=>a.correct);const next=rewardMatch(profile,battle.result||'loss',answers.current,battle.played,match.id,{at:Date.now(),arena:match.arena,difficulty:match.difficulty,crowns:battle.towers.filter(t=>t.side==='bot'&&t.hp<=0).length,rewarded:rated,forfeit:forfeit.current});if(!rated){next.xp=profile.xp;next.coins=profile.coins;next.trophies=profile.trophies;}await writeLocalRecord(profileKey,next);result={profile:next,outcome:battle.result||'loss',rewarded:rated};}
   else result=await royaleRequest<Finish>(user,{action:'finish',matchId:match.id,commands:commands.current,endTick:battle.tick,forfeit:forfeit.current});
   committed.current=true;await pendingStorage.current.catch(()=>undefined);await writeLocalRecord(storageKey,null);if(alive.current){setFinishResult(result);onProfile(result.profile);soundRef.current?.play(result.outcome==='win'?'win':'loss');}
  }catch(error){if(alive.current)setFinishError(error instanceof Error?error.message:'Результат ожидает отправки.');}finally{if(alive.current)setSaving(false);}
 },[finishResult,match.arena,match.difficulty,match.id,match.practice,onProfile,profile,profileKey,saving,storageKey,store,user]);
 useEffect(()=>{if(hud.result&&!finishedOnce.current){finishedOnce.current=true;queueMicrotask(()=>{setAudioOpen(false);void finalize();});}},[hud.result,finalize]);
 function choose(card:CardId){setPlacementPending(false);const battle=battleRef.current!;if(battle.result||hud.catchingUp)return;setSelected(card);selectedRef.current=card;canvas.current?.focus({preventScroll:true});setMessage(viewMode==='3d'?'Выберите точку на своей стороне и подтвердите размещение. Заклинания доступны по всему полю.':'Коснитесь своей половины арены. Заклинание можно направить на любую область.');}
 function deploy(x:number,y:number){const battle=battleRef.current!;const card=selectedRef.current;if(!card||battle.result||hud.catchingUp)return;if(battle.energy<cards[card].cost){setMessage('Недостаточно энергии. Решите задачу, чтобы пополнить запас.');return;}if(!canPlace(battle,card,x,y)){setMessage('Выберите свободное место на своей стороне, вне башен.');return;}const command:GameCommand={tick:battle.tick,kind:'deploy',card,x:Math.round(x*10)/10,y:Math.round(y*10)/10};if(applyCommand(battle,command)){commands.current.push(command);selectedRef.current=null;setSelected(null);setPlacementPending(false);setHud(previous=>({...previous,energy:battle.energy,hand:[...battle.hand]}));setMessage(`${cards[card].name}: на арене`);soundRef.current?.play('spawn');void store();}}
 function pick(event:PointerEvent<HTMLCanvasElement>){const rect=event.currentTarget.getBoundingClientRect();return viewRef.current?.pick(event.clientX,event.clientY,rect)||null;}
 function place(event:PointerEvent<HTMLCanvasElement>){event.preventDefault();const point=pick(event);if(!point)return;cursor.current=point;if(viewMode==='3d'){if(selectedRef.current)setPlacementPending(true);}else deploy(point.x,point.y);}
 function movePreview(event:PointerEvent<HTMLCanvasElement>){if(viewMode==='3d'&&selectedRef.current&&!placementPending){const point=pick(event);if(point)cursor.current=point;}}
 function switchView(mode:GraphicsMode){setViewMode(mode);updatePreferences({graphics:mode});setPlacementPending(false);void store();}
 async function loadTask(){const battle=battleRef.current!;if(taskBusy||battle.result)return;setTaskBusy(true);setMessage('');questionFocus.current=0;focusActive.current=true;
  try{let issued:IssuedTask;if(match.practice){const eligible=catalog.filter(q=>!used.current.includes(q.id)&&!settings.disabled.includes(q.id)&&(!newOnly||!profile.solvedQuestionIds.includes(q.id))&&(section==='all'||q.section===section)&&(match.section==='all'||q.section===match.section)&&(!match.topics.length||q.topics.some(t=>match.topics.includes(t)))&&(topic==='all'||q.topics.includes(topic))&&(tier==='all'||(settings.taskTiers[q.id]||q.gameTier)===tier));if(!eligible.length)throw Error('Задачи с такими фильтрами закончились. Выберите другую тему или сложность.');const question=eligible[Math.floor(Math.random()*eligible.length)],classification=settings.taskTiers[question.id]||question.gameTier;issued={challengeId:crypto.randomUUID(),question,tier:classification,reward:settings.rewards[classification]};}
   else issued=await royaleRequest<IssuedTask>(user,{action:'question',matchId:match.id,tick:battle.tick,tier,topic,section,newOnly});
   if(!alive.current)return;setEarned(0);setFeedback(null);feedbackRef.current=null;setInput('');typedRef.current='';if(issued.focusRemaining!==undefined)focusRemaining.current=Math.min(focusRemaining.current,issued.focusRemaining);if(issued.focusAllowance!==undefined)questionFocus.current=Math.max(questionFocus.current,balance.focusPerQuestionSeconds-issued.focusAllowance);if(issued.syncTick&&issued.syncTick>battle.tick)advanceBattle(battle,issued.syncTick);if(!used.current.includes(issued.question.id))used.current.push(issued.question.id);taskRef.current=issued;setTask(issued);void store();
  }catch(error){focusActive.current=false;if(alive.current)setMessage(error instanceof Error?error.message:'Задача недоступна.');}finally{if(alive.current)setTaskBusy(false);}
 }
 function openTask(){const battle=battleRef.current!;if(battle.result)return;taskTrigger.current=document.activeElement instanceof HTMLElement?document.activeElement:null;setAudioOpen(false);setStatsOpen(false);setPanel(true);focusActive.current=!feedbackRef.current;if(!taskRef.current)void loadTask();}
 async function check(){const battle=battleRef.current!;if(!taskRef.current||taskBusy||feedbackRef.current||!input.trim()||battle.result)return;setTaskBusy(true);setMessage('');const current=taskRef.current;
  try{const response=match.practice?await royaleRequest<{result:TrainerCheckResult}>(null,{action:'practice-answer',questionId:current.question.id,answer:input}):await royaleRequest<{result:TrainerCheckResult;receipt:{id:string;amount:number;minTick:number;focusRemaining?:number}}>(user,{action:'answer',matchId:match.id,challengeId:current.challengeId,answer:input,tick:battle.tick});
   if(!alive.current)return;focusActive.current=false;feedbackRef.current=response.result;setFeedback(response.result);answers.current.push({correct:response.result.correct===true,topics:current.question.topics,section:current.question.section,questionId:current.question.id});setAnswerHistory([...answers.current]);
   const receipt='receipt'in response?response.receipt as {id:string;amount:number;minTick:number;focusRemaining?:number}:{id:current.challengeId,amount:response.result.correct?current.reward:0,minTick:battle.tick};
   if(receipt.focusRemaining!==undefined)focusRemaining.current=Math.min(focusRemaining.current,receipt.focusRemaining);if(receipt.minTick>battle.tick&&!battle.result)advanceBattle(battle,receipt.minTick);if(receipt.amount&&!battle.result){const previous=battle.energy,command:GameCommand={kind:'reward',tick:battle.tick,id:receipt.id,amount:receipt.amount};if(applyCommand(battle,command)){commands.current.push(command);setEarned(battle.energy-previous);}}
   soundRef.current?.play(response.result.correct?'correct':'wrong');void store();
  }catch(error){if(alive.current)setMessage(error instanceof Error?error.message:'Не удалось проверить ответ. Энергия не начислена.');}finally{if(alive.current)setTaskBusy(false);}
 }
 function closeTask(){
  focusActive.current=false;
  setPanel(false);
  requestAnimationFrame(() => taskTrigger.current?.focus({ preventScroll: true }));
  void store();
 }
 function quit(){if(!battleRef.current!.result){paused.current=match.practice;setConfirmQuit(true);}else onReturn();}
 function resume(){paused.current=false;setConfirmQuit(false);}
 function leaveBattle(){paused.current=false;forfeit.current=true;battleRef.current!.result='loss';setConfirmQuit(false);setHud(previous=>({...previous,result:'loss',forfeit:true}));}
 const seconds=Math.max(0,balance.matchSeconds-Math.floor(hud.tick*balance.tickMs/1000)),outcome=finishResult?.outcome||hud.result;
 const questionSeconds = feedback || (!task && !taskBusy) ? 0 :
  Math.max(0, Math.ceil(Math.min(balance.focusPerQuestionSeconds - hud.questionFocus, hud.focus)));
 return (
  <main ref={gameRoot} className={`${s.game} ${b.game}`} data-graphics={viewMode} data-task={lessonOpen}
    data-viewport={theater}>
   <header className={b.topBar} inert={mobile && lessonOpen}>
    <div className={b.wordmark} aria-label="Physics Royale">
     <div className={b.crest}><BattleIcon name="atom"/></div>
     <div aria-hidden="true">PHYSICS<span>ROYALE</span></div>
    </div>
    <div className={b.scoreboard}>
     <div className={b.team} data-team="player" aria-label="Башни, разрушенные игроком">
      <BattleIcon name="crown"/><b key={hud.scorePlayer}>{hud.scorePlayer}</b>
     </div>
     <div className={b.clock} aria-label="Осталось времени" data-urgent={seconds <= 30}>
      <span key={seconds}>{Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, '0')}</span>
     </div>
     <div className={b.team} data-team="opponent" aria-label="Башни, разрушенные соперником">
      <b key={hud.scoreBot}>{hud.scoreBot}</b><BattleIcon name="crown"/>
     </div>
    </div>
    <div className={b.toolbar}>
     <button type="button" className={b.iconButton} onClick={() => {
      setStatsOpen(!statsOpen); setAudioOpen(false);
     }} aria-expanded={statsOpen} aria-label="Статистика матча" title="Статистика матча"><BattleIcon name="stats"/></button>
     <button type="button" className={b.iconButton} onClick={() => {
      setAudioOpen(!audioOpen); setStatsOpen(false);
     }} aria-expanded={audioOpen} aria-label="Настройки звука и графики" title="Настройки"><BattleIcon name="settings"/></button>
     <button type="button" className={b.iconButton} onClick={() => void toggleFullscreen()}
       aria-pressed={fullscreen || theater} aria-label={fullscreen || theater ? 'Выйти из полноэкранного режима' : 'Полноэкранный режим'}
       title={fullscreen || theater ? 'Выйти из полноэкранного режима' : 'Полноэкранный режим'}>
      <BattleIcon name={fullscreen || theater ? 'shrink' : 'fullscreen'}/>
     </button>
     <button type="button" className={b.iconButton} onClick={quit} aria-label={match.practice ? 'Пауза' : 'Меню'}
      title={match.practice ? 'Пауза' : 'Меню'}><BattleIcon name="pause"/></button>
    </div>
   </header>
   <section className={b.battlefield} aria-label={arena.name} inert={mobile && lessonOpen}>
    <canvas key={viewMode} ref={canvas} className={b.arena} role="application" tabIndex={0}
     aria-label="Арена Physics Royale. Выберите карту; стрелками перемещайте прицел, Enter размещает войско."
     onPointerDown={place} onPointerMove={movePreview} onKeyDown={event => {
      const directions: Record<string, [number, number]> = {ArrowLeft: [-15,0], ArrowRight: [15,0], ArrowUp: [0,-15], ArrowDown: [0,15]};
      const offset = directions[event.key];
      if (offset) {
       event.preventDefault();
       cursor.current = {x: Math.max(18, Math.min(402, cursor.current.x + offset[0])), y: Math.max(18, Math.min(702, cursor.current.y + offset[1]))};
      }
      if (event.key === 'Enter') { event.preventDefault(); deploy(cursor.current.x, cursor.current.y); }
     }}/>
    {viewLoading !== null && <div className={b.assetLoading} role="status">
     <BattleIcon name="atom"/><div><b>Загрузка 3D-арены · {viewLoading}%</b>
      <progress max={100} value={viewLoading} aria-label="Загрузка 3D-ресурсов"/>
     </div>
    </div>}
    {hud.catchingUp && <p className={b.battleNotice} role="status">Восстанавливаем ход боя…</p>}
   </section>
   <section className={b.dock} aria-label="Карты и энергия" inert={mobile && lessonOpen}>
    {selected ? <div className={b.placement}>
     {viewMode === '3d' && <button type="button" className={b.goldButton}
      disabled={(!placementPending && hud.energy >= cards[selected].cost) || hud.catchingUp || Boolean(hud.result)}
      onClick={() => {
       if (hud.energy < cards[selected].cost) openTask();
       else deploy(cursor.current.x,cursor.current.y);
      }}>
      {hud.energy < cards[selected].cost ? 'Решить задачу · нужна энергия' : placementPending ? 'Разместить: ' + cards[selected].name : 'Выберите точку на поле'}
     </button>}
     <button type="button" className={b.iconButton} aria-label="Отменить выбор карты" onClick={() => {
      selectedRef.current = null; setSelected(null); setPlacementPending(false);
     }}><BattleIcon name="close"/></button>
    </div> : message && !lessonOpen && <p className={b.dockNotice} role="status">{message}</p>}
    {selected && message && !lessonOpen && <p className={b.srOnly} role="status">{message}</p>}
    <div className={b.hand} aria-label="Четыре активные карты">
     {hud.hand.map(card => <button type="button" className={b.card} key={card}
      data-card={card} data-unaffordable={hud.energy < cards[card].cost} aria-pressed={selected === card}
      aria-label={`${cards[card].name}, ${cards[card].cost} энергии`}
      disabled={Boolean(hud.result) || hud.catchingUp} onClick={() => choose(card)}>
      <CardArtwork id={card}/><span className={b.cardCost}>{cards[card].cost}</span>
      <b>{cards[card].name}</b>
     </button>)}
    </div>
    <div className={b.energy} ref={energyRef} data-earned={earned > 0}>
     <div className={b.energyGem}><BattleIcon name="energy"/></div>
     <span className={b.energyNumber}><b>{hud.energy}</b><small> / {balance.maxEnergy}</small></span>
     <div className={b.energySegments} role="meter" aria-label="Энергия" aria-valuemin={0}
      aria-valuemax={balance.maxEnergy} aria-valuenow={hud.energy}>
      {Array.from({length: balance.maxEnergy}, (_, index) => <i key={index} data-filled={hud.energy > index}/>)}
     </div>
    </div>
    <button type="button" className={`${b.goldButton} ${b.solve}`}
     data-needs-energy={hud.hand.some(card => hud.energy < cards[card].cost)}
     aria-controls="royale-task" aria-expanded={lessonOpen} disabled={Boolean(hud.result) || hud.catchingUp} onClick={openTask}>
     <i aria-hidden="true"><BattleIcon name="atom"/></i>
     <span><b>Решить задачу</b><small>+{settings.rewards.easy} / +{settings.rewards.medium} / +{settings.rewards.hard}</small></span>
    </button>
   </section>
   <RoyaleTaskPanel open={lessonOpen} mobile={mobile} task={task} feedback={feedback} input={input}
    busy={taskBusy} ended={Boolean(outcome)} earned={earned} message={panel ? message : ''}
    slow={hud.slow} questionSeconds={questionSeconds} matchSeconds={Math.ceil(hud.focus)} catalog={catalog}
    match={match} tier={tier} section={section} topic={topic} newOnly={newOnly} rewardRef={rewardRef}
    onTier={setTier} onSection={value => { setSection(value); setTopic('all'); }} onTopic={setTopic}
    onNewOnly={setNewOnly} onInput={value => { setInput(value); typedRef.current = value; }}
    onCheck={() => void check()} onNext={() => void loadTask()} onClose={closeTask}/>
   {earned > 0 && <BattleEnergyBurst from={rewardRef} to={energyRef} mobile={mobile}/>}
   {audioOpen && !outcome && <section className={b.popover} aria-label="Звук и графика"
    onKeyDown={event => { if (event.key === 'Escape') setAudioOpen(false); }}>
    <div className={b.popoverHeading}><h2>Звук и графика</h2>
     <button type="button" className={b.iconButton} onClick={() => setAudioOpen(false)} aria-label="Закрыть настройки"><BattleIcon name="close"/></button>
    </div>
    <PreferenceFields value={preferences} onChange={updatePreferences}/>
    <button type="button" className={b.secondaryButton} onClick={() => switchView(viewMode === '3d' ? '2d' : '3d')}>
     {viewMode === '3d' ? 'Перейти в 2D' : 'Перейти в 3D'}
    </button>
   </section>}
   {statsOpen && !outcome && <section className={b.popover} aria-label="Статистика матча"
    onKeyDown={event => { if (event.key === 'Escape') setStatsOpen(false); }}>
    <div className={b.popoverHeading}><h2>Статистика матча</h2>
     <button type="button" className={b.iconButton} onClick={() => setStatsOpen(false)} aria-label="Закрыть статистику"><BattleIcon name="close"/></button>
    </div>
    <dl><div><dt>Башни</dt><dd>{hud.scorePlayer} : {hud.scoreBot}</dd></div>
     <div><dt>Верные ответы</dt><dd>{answerSummary.correct} / {answerSummary.total}</dd></div>
     <div><dt>Энергия</dt><dd>{hud.energy} / {balance.maxEnergy}</dd></div>
     <div><dt>Частота кадров</dt><dd>{performanceStats.fps || '—'} FPS</dd></div>
     <div><dt>Кадр / отрисовка</dt><dd>{performanceStats.frameMs.toFixed(1)} / {performanceStats.renderMs.toFixed(1)} мс</dd></div>
     {viewMode === '3d' && <div><dt>Вызовы / треугольники</dt><dd>{performanceStats.calls} / {performanceStats.triangles.toLocaleString('ru-RU')}</dd></div>}
    </dl>
   </section>}

 {confirmQuit&&!outcome&&<StudioDialog title={match.practice?"Пауза":"Завершить бой?"} id="royale-confirm-exit" onClose={resume}><p>Досрочный выход не приносит кубков, XP или монет.</p><button onClick={resume}>Продолжить бой</button><button onClick={leaveBattle}>Завершить без наград</button></StudioDialog>}
 {outcome&&<StudioDialog title="Результат боя" id="royale-match-result" onClose={()=>{if(!saving)onReturn();}}><div className={s.result} data-outcome={outcome}><img src="/royale/trophy.svg" alt=""/><span className={s.eyebrow}>БОЙ ЗАВЕРШЁН</span><h1>{hud.forfeit?'Бой завершён досрочно':outcome==='win'?'Победа!':outcome==='draw'?'Достойная ничья':'Следующий бой будет вашим'}</h1><p>{answerSummary.correct} верных ответов из {answerSummary.total} попыток.</p><MissedQuestions catalog={catalog} answers={answerHistory}/>{saving&&<p role="status">Проверяем запись боя и сохраняем результат…</p>}{finishResult&&<><div className={s.resultMetrics}><span><b>{hud.scorePlayer}</b> башен</span><span><b>{answerSummary.total?Math.round(answerSummary.correct/answerSummary.total*100):0}%</b> точность</span><span><b>{finishResult.profile.trophies-baseline.trophies>0?'+':''}{finishResult.profile.trophies-baseline.trophies}</b> кубков</span><span><b>+{finishResult.profile.xp-baseline.xp}</b> XP</span><span><b>+{finishResult.profile.coins-baseline.coins}</b> монет</span></div>{finishResult.profile.achievements.filter(id=>!baseline.achievements.includes(id)).map(id=><p key={id} className={s.notice}>Новое достижение: {achievementLabels[id]}</p>)}{!finishResult.rewarded&&<p>За досрочный бой или бой без верных ответов награды не начисляются.</p>}{outcome==='loss'&&!hud.forfeit&&<p>Попробуйте выпустить танка впереди стрелков и сохранить дешёвый отряд для защиты.</p>}</>}{finishError&&<><p className={s.error} role="alert">{finishError}</p><button onClick={()=>void finalize()} disabled={saving}>Повторить сохранение</button></>}<button className={s.primary} disabled={saving||!finishResult} onClick={onRematch}>Ещё один бой</button><button disabled={saving} onClick={onDeck}>Изменить колоду</button><button className={s.primary} disabled={saving} onClick={onReturn}>{finishResult?'Вернуться в меню':'Вернуться в меню · запись останется на устройстве'}</button></div></StudioDialog>}
  </main>
 );
}
