'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { User } from 'firebase/auth';
import { royaleRequest } from '@/lib/royale/client';
import { arenas } from '@/lib/royale/config';
import { accuracy, topicRows } from '@/lib/royale/learning';
import type { MatchHistory, RoyaleProfile } from '@/lib/royale/progress';
import { KingdomDialog } from './KingdomDialog';
import { MissedQuestions } from './MissedQuestions';
import type { GameTask } from './types';
import k from './Kingdom.module.css';

const outcomes={win:'Победа',loss:'Поражение',draw:'Ничья'};
type PlatformStats={attempts:number;solved:number;accuracy:number|null;topics:{topic:string;attempts:number;accuracy:number|null}[]};

function AccuracyChart({history}:{history:MatchHistory[]}){
 const games=history.filter(game=>game.attempts>0).slice(-10);
 if(!games.length)return <p>Точность по боям появится после первого проверенного ответа.</p>;
 const points=games.map((game,index)=>({id:game.id,x:games.length===1?188:32+312*index/(games.length-1),y:118-accuracy(game.attempts,game.correct)!,label:accuracy(game.attempts,game.correct)+'%'}));
 const line=points.map(point=>point.x+','+point.y).join(' ');
 return <figure className={k.chart}>
  <svg viewBox="0 0 370 147" role="img" aria-label={'Точность по последним боям: '+points.map(p=>p.label).join(', ')}>
   <defs><linearGradient id="kingdom-chart" x1="0" x2="0" y1="0" y2="1" gradientUnits="objectBoundingBox"><stop stopColor="#9470ff" stopOpacity=".48"/><stop offset="1" stopColor="#9470ff" stopOpacity=".02"/></linearGradient></defs>
   {[18,68,118].map((y,index)=><g key={y}><line x1="32" x2="344" y1={y} y2={y} stroke="#b9caf9" opacity=".18"/><text x="1" y={y+4}>{[100,50,0][index]}%</text></g>)}
   {points.length>1&&<polygon points={`${points[0].x},118 ${line} ${points[points.length-1].x},118`} fill="url(#kingdom-chart)"/>}
   <polyline points={line} stroke="#c3a5ff" strokeWidth="3" fill="none" strokeLinejoin="round"/>
   {points.map(point=><circle key={point.id} cx={point.x} cy={point.y} r="4" fill="#f9d89a"><title>{point.label}</title></circle>)}
  </svg>
  <figcaption>{games.length} из последних 10 боёв с ответами</figcaption>
 </figure>;
}

export function KingdomStats({profile,topics,catalog,user}:{profile:RoyaleProfile;topics:string[];catalog:GameTask[];user:User|null}) {
 const [platform,setPlatform]=useState<{data?:PlatformStats;error?:boolean}>({});
 const [review,setReview]=useState<MatchHistory|null>(null);
 const [topicLimit,setTopicLimit]=useState(6);
 useEffect(()=>{
  if(!user)return;
  const abort=new AbortController();
  void royaleRequest<PlatformStats>(user,undefined,'?view=learning',abort.signal)
   .then(data=>setPlatform({data})).catch(()=>{if(!abort.signal.aborted)setPlatform({error:true});});
  return()=>abort.abort();
 },[user]);
 const rows=topicRows(profile.topics,topics).sort((a,b)=>a.percent-b.percent||b.attempts-a.attempts);
 const reliable=rows.filter(row=>row.attempts>=3);
 const strong=reliable.filter(row=>row.percent>=80).slice(-3).reverse();
 const weak=reliable.filter(row=>row.percent<65).slice(0,3);
 const suggested=(weak.length?weak:rows.filter(row=>row.correct<row.attempts)).slice(0,3);
 const metrics=[['Матчи',profile.matches],['Решено задач',profile.solvedQuestionIds.length],['Верные ответы',profile.correct],['Точность',profile.attempts?accuracy(profile.attempts,profile.correct)+'%':'—']];
 return <section className={k.pane} aria-labelledby="kingdom-stats">
  <header className={k.paneHeading}><div><span className={k.kicker}>Бои и обучение</span><h1 id="kingdom-stats">Статистика</h1></div><Link className={k.subButton} href="/trainer">Тренажёр ЕГЭ ↗</Link></header>
  <div className={k.statCards}>{metrics.map(([name,value])=><article key={name}><b>{value}</b><span>{name}</span></article>)}</div>
  <div className={k.progressColumns}>
   <section className={k.panel}><h2>Динамика точности</h2><AccuracyChart history={profile.history}/></section>
   <section className={k.panel}><h2>Темы для повторения</h2>
    {suggested.length>0?<ul className={k.progressTopics}>{suggested.map(topic=><li key={topic.topic}><span>{topic.topic}</span><b>{topic.attempts-topic.correct} с ошибкой</b></li>)}</ul>
    :<p>{rows.length?'В проверенных ответах пока нет ошибок.':'После первых ответов здесь появятся рекомендации.'}</p>}
    {suggested.length>0&&<Link href="/trainer">Выбрать тему в тренажёре ↗</Link>}
    <p><b>Сильные темы</b> · {strong.length?strong.map(t=>t.topic).join(', '):'пока недостаточно данных'}</p>
    <p><b>Слабые темы</b> · {weak.length?weak.map(t=>t.topic).join(', '):reliable.length?'нет тем с точностью ниже 65%':'пока недостаточно данных'}</p>
   </section>
  </div>
  <div className={k.progressColumns}>
   <section className={k.panel}><h2>Точность по темам боя</h2>
    {rows.length>0?<ul className={k.progressTopics}>{rows.slice(0,topicLimit).map(topic=><li key={topic.topic}><span>{topic.topic}</span><progress aria-label={topic.topic} max={topic.attempts} value={topic.correct}/><b>{topic.correct}/{topic.attempts}</b></li>)}</ul>:<p>Пока нет ответов по темам.</p>}
    {rows.length>topicLimit&&<button className={k.subButton} onClick={()=>setTopicLimit(rows.length)}>Показать все темы</button>}
   </section>
   <section className={k.panel}><h2>Подготовка на платформе</h2>
    {!user?<p>Войдите в аккаунт, чтобы увидеть сохранённые результаты тренажёра.</p>:platform.error?<p role="status">Сводка платформы сейчас недоступна.</p>:platform.data?<>
     <p><b>{platform.data.solved}</b> решено · <b>{platform.data.attempts}</b> попыток · <b>{platform.data.accuracy===null?'—':Math.round(platform.data.accuracy)+'%'}</b> точность</p>
     <ul className={k.progressTopics}>{platform.data.topics.slice().sort((a,b)=>(a.accuracy??100)-(b.accuracy??100)).slice(0,5).map(topic=><li key={topic.topic}><span>{topic.topic}</span><b>{Math.round(topic.accuracy??0)}%</b></li>)}</ul>
    </>:<p role="status">Загружаем сводку платформы…</p>}
   </section>
  </div>
  <section className={k.panel}><h2>История матчей</h2>
   {profile.history.length>0?<ol className={k.matchHistory}>{profile.history.slice().reverse().map(match=><li key={match.id}>
    <div><strong data-result={match.outcome}>{match.forfeit?'Досрочный выход':outcomes[match.outcome]}</strong><time dateTime={new Date(match.at).toISOString()}>{new Date(match.at).toLocaleString('ru-RU',{dateStyle:'short',timeStyle:'short'})}</time></div>
    <div><b>{arenas.find(arena=>arena.id===match.arena)?.name??match.arena}</b><span>{match.correct} / {match.attempts} верно{match.learning?` · +${match.learning.energy} энергии`:''}</span></div>
    <b>{match.trophies>0?'+':''}{match.trophies} кубков</b>
    {Boolean(match.learning?.missedIds.length)&&<button className={k.subButton} onClick={()=>setReview(match)}>Разобрать ошибки</button>}
   </li>)}</ol>:<p>Завершённые матчи появятся здесь.</p>}
  </section>
  {review&&<KingdomDialog title="Разбор ошибок матча" onClose={()=>setReview(null)} kind="review">
   <header className={k.dialogHead}><h2>Разбор ошибок матча</h2><button className={k.iconButton} onClick={()=>setReview(null)} aria-label="Закрыть разбор">×</button></header>
   <MissedQuestions catalog={catalog} answers={review.learning!.missedIds.map(questionId=>({questionId,correct:false,section:'',topics:[]}))}/>
  </KingdomDialog>}
 </section>;
}
