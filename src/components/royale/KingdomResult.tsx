'use client';
import { useEffect, useRef, useState } from 'react';
import type { MatchHistory } from '@/lib/royale/progress';
import { accuracy, type LearningRecap } from '@/lib/royale/learning';
import { KingdomDialog } from './KingdomDialog';
import { KingdomMark, LeagueBadge } from './KingdomMarks';
import { MissedQuestions } from './MissedQuestions';
import type { GameTask } from './types';
import k from './Kingdom.module.css';
import r from './CinematicResult.module.css';
import { leagueProgress } from '@/lib/royale/leagues';
import { RoyaleIcon } from './RoyaleIcon';
import {ResultHero} from './ResultHero';
import type {KingdomQuality} from '@/lib/royale/quality';
import {ResultRegalia} from './ResultRegalia';
import { BattleIcon } from './RoyaleBattleIcon';

const titles = { win:'Победа!', loss:'Поражение', draw:'Ничья' };
const signed = (value: number) => value > 0 ? '+' + value : String(value);

function TrophyCount({total,skip}:{total:number|null;skip:boolean}) {
 const [value,setValue]=useState(total??0);
 useEffect(()=>{
  if(total===null||skip||matchMedia('(prefers-reduced-motion: reduce)').matches)return;
  let frame=0,started:number|undefined;
  function advance(time:number){
   if(total===null)return;
   started??=time;
   const progress=Math.min((time-started)/540,1);
   setValue(Math.round(total*(1-Math.pow(1-progress,3))));
   if(progress<1)frame=requestAnimationFrame(advance);
  }
  frame=requestAnimationFrame(advance);
  return()=>cancelAnimationFrame(frame);
 },[skip,total]);
 return total===null?'—':<><span className={k.trophyValue} aria-hidden="true">{signed(skip?total:value)}</span><span className={k.srOnly}>{signed(total)}</span></>;
}

export function KingdomResult({outcome,forfeit,score,record,trophies,quality,pending,saving,error,saved,catalog,onRetry,onMenu,onStats,onLeague,onDeck,onRematch}: {
 outcome: keyof typeof titles; forfeit: boolean; score:[number,number]; record?:MatchHistory; trophies?:number; quality:KingdomQuality; pending:LearningRecap;
 saving:boolean; error:string; saved:boolean; catalog:GameTask[]; onRetry:()=>void; onMenu:()=>void; onStats:()=>void; onLeague:()=>void; onDeck:()=>void; onRematch:()=>void;
}) {
 const [review,setReview] = useState(false);
 const [skip,setSkip] = useState(false);
 const menuButton=useRef<HTMLButtonElement>(null);
 const reviewPanel=useRef<HTMLDivElement>(null);
 useEffect(()=>{if(review)reviewPanel.current?.focus();},[review]);
 const title=forfeit?'Бой завершён досрочно':titles[outcome];
 const result=forfeit?'forfeit':outcome;
 const report=record?.learning ?? pending;
 const attempts=record?.attempts ?? report.attempts;
 const correct=record?.correct ?? report.correct;
 const percent=accuracy(attempts,correct);
 const standing=trophies===undefined?null:leagueProgress(trophies);
 const previous=record&&trophies!==undefined?leagueProgress(trophies-record.trophies):null;
 const promotion=!forfeit&&record&&record.trophies>0&&standing&&previous&&standing.index>previous.index;
 const subjects=Object.entries(report.topics).sort(([a],[b])=>a.localeCompare(b,'ru'));
 const mistakes=subjects.filter(([,v])=>v.correct<v.attempts).sort((a,b)=>(b[1].attempts-b[1].correct)-(a[1].attempts-a[1].correct));
 return <KingdomDialog className={r.dialog} title={title} onClose={()=>{if(!saving)onMenu();}} kind={result}>
  <div className={r.stage} data-skip={skip} data-result={result}>
   <div className={r.landscape} aria-hidden="true"/>
   <ResultHero result={result} quality={quality} skip={skip}/>
   {(result==='win'||result==='loss')&&<div className={r.sparks} aria-hidden="true"/>}
   <div className={r.content}>
    {!skip&&<button className={r.skip} type="button" onClick={()=>{setSkip(true);menuButton.current?.focus();}}>Пропустить анимацию</button>}
    <header className={r.banner}>
     <div className={r.regalia} data-ornate={result==='win'||result==='loss'}>
      {result==='win'||result==='loss'?<ResultRegalia win={result==='win'}/>:<div className={r.emblem}><KingdomMark name="atom" size={62}/></div>}
      <h1>{title}</h1>
     </div>
     <div className={r.score} aria-label={`Счёт ${score[0]} : ${score[1]}`}><b>{score[0]}</b><RoyaleIcon name="swords"/><b>{score[1]}</b></div>
     {result==='loss'&&<p>Следующий бой можно начать с разбора трудных задач.</p>}
    </header>
    <div className={r.rewards}>
     <div className={r.delta}><BattleIcon name="crown"/><div><small>Изменение кубков</small><b><TrophyCount key={record?.trophies??'pending'} total={record?.trophies??null} skip={skip}/></b></div></div>
     {standing&&<div className={r.rank}>
      <LeagueBadge {...standing.current}/><div><small>{trophies?.toLocaleString('ru-RU')} кубков всего</small><b>{standing.current.name}</b></div>
     </div>}
     {record&&<div className={r.experience}><small>Опыт за бой</small><b>+{record.xp} XP</b></div>}
    </div>
    {promotion&&<aside className={r.promotion} role="status">
     <span className={r.leagueArtwork} style={{backgroundImage:`url(/royale/cinematic/league-${standing.index}.webp)`}} aria-hidden="true"/>
     <LeagueBadge {...standing.current}/><div><small>Новая лига</small><b>{standing.current.name}</b><p>{trophies} кубков · порог {standing.current.trophies}</p></div>
     <button type="button" onClick={onLeague}>К карте лиг</button>
    </aside>}
    <section className={r.learning} aria-label="Учебные итоги">
     <div><span><BattleIcon name="stats"/>Точность</span><b>{percent===null?'—':percent+'%'}</b>{percent!==null&&<progress aria-label="Точность ответов" value={percent} max={100}/>}</div>
     <div><span><BattleIcon name="book"/>Верные ответы</span><b>{correct} <small>/ {attempts}</small></b><small>С ошибкой: {attempts-correct}</small></div>
     <div className={r.energy}><span><BattleIcon name="energy"/>Энергия за задачи</span><b>+{report.energy}</b><small>за этот бой</small></div>
    </section>
    {subjects.length>0?<section className={r.topics}><h2>Итоги по темам</h2><ul>{subjects.map(([topic,v])=><li key={topic}><span>{topic}</span><b>{v.correct} / {v.attempts}</b></li>)}</ul>
     {mistakes.length>0&&<p>Стоит повторить: {mistakes[0][0]}</p>}</section>:
     <p className={r.empty}>В этом бою не было проверенных ответов. Открой статистику или попробуй решить задачу в следующем матче.</p>}
    {saving&&<p role="status">Сохраняем результат боя…</p>}
    {error&&<p className={k.alert} role="alert">{error} <button onClick={onRetry} disabled={saving}>Повторить сохранение</button></p>}
    <footer className={r.actions}>
     <button ref={menuButton} disabled={saving} onClick={onMenu}>В главное меню</button>
     <button disabled={saving} onClick={onStats}>Статистика</button>
     {report.missedIds.length>0&&<button type="button" aria-expanded={review} onClick={()=>setReview(!review)}>{review?'Скрыть разбор':'Разобрать ошибки'}</button>}
     <button className={r.primary} disabled={saving||!saved} onClick={onRematch}><RoyaleIcon name="swords"/>Новый матч</button>
     <button disabled={saving} onClick={onDeck}>Изменить колоду</button>
    </footer>
    {review&&<div ref={reviewPanel} className={r.review} tabIndex={-1}><MissedQuestions catalog={catalog} answers={report.missedIds.map(questionId=>({questionId,correct:false,section:'',topics:[]}))}/></div>}
   </div>
  </div>
 </KingdomDialog>;
}
