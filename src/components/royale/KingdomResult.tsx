'use client';
import { useState } from 'react';
import type { MatchHistory } from '@/lib/royale/progress';
import { accuracy, type LearningRecap } from '@/lib/royale/learning';
import { KingdomDialog } from './KingdomDialog';
import { KingdomMark } from './KingdomMarks';
import { MissedQuestions } from './MissedQuestions';
import type { GameTask } from './types';
import k from './Kingdom.module.css';

const titles = { win:'Победа!', loss:'Поражение', draw:'Ничья' };
const signed = (value: number) => value > 0 ? '+' + value : String(value);

export function KingdomResult({outcome,forfeit,score,record,pending,saving,error,saved,catalog,onRetry,onMenu,onDeck,onRematch}: {
 outcome: keyof typeof titles; forfeit: boolean; score:[number,number]; record?:MatchHistory; pending:LearningRecap;
 saving:boolean; error:string; saved:boolean; catalog:GameTask[]; onRetry:()=>void; onMenu:()=>void; onDeck:()=>void; onRematch:()=>void;
}) {
 const [review,setReview] = useState(false);
 const title = forfeit ? 'Бой завершён досрочно' : titles[outcome];
 const report = record?.learning ?? pending;
 const attempts = record?.attempts ?? report.attempts;
 const correct = record?.correct ?? report.correct;
 const percent = accuracy(attempts,correct);
 const mistakes = Object.entries(report.topics).filter(([,v])=>v.correct<v.attempts).sort((a,b)=>(b[1].attempts-b[1].correct)-(a[1].attempts-a[1].correct));
 return <KingdomDialog title={title} onClose={()=>{if(!saving)onMenu();}} kind={outcome}>
  <div className={k.resultHero}>
   <div className={k.resultEmblem}><KingdomMark name={outcome==='win'?'crown':outcome==='loss'?'compass':'atom'} size={56}/></div>
   <p className={k.kicker}>Итог битвы · {score[0]} : {score[1]}</p><h1>{title}</h1>
  </div>
  <div className={k.resultMetrics}>
   <div><b>{record?signed(record.trophies):'—'}</b><span>Кубки</span></div>
   <div><b>{attempts}</b><span>Проверено задач</span></div>
   <div><b>{correct}</b><span>Верные ответы</span></div>
   <div><b>{percent===null?'—':percent+'%'}</b><span>Точность</span></div>
   <div><b>+{report.energy}</b><span>Энергия</span></div>
  </div>
  {mistakes.length>0&&<section className={k.resultMistakes}><h2>Что повторить</h2><ul>{mistakes.map(([topic,v])=><li key={topic}><b>{topic}</b><span>{v.attempts-v.correct} из {v.attempts} с ошибкой</span></li>)}</ul></section>}
  {review&&<MissedQuestions catalog={catalog} answers={report.missedIds.map(questionId=>({questionId,correct:false,section:'',topics:[]}))}/>}
  {saving&&<p role="status">Сохраняем результат боя…</p>}
  {saved&&record&&<p className={k.rewardLine}>Опыт <b>+{record.xp} XP</b> <span>Монеты <b>+{record.coins}</b></span></p>}
  {error&&<p className={k.alert} role="alert">{error} <button onClick={onRetry} disabled={saving}>Повторить сохранение</button></p>}
  <div className={k.actions}>
   {report.missedIds.length>0&&<button type="button" aria-expanded={review} onClick={()=>setReview(!review)}>{review?'Скрыть разбор':'Разобрать ошибки'}</button>}
   <button className={k.goldButton} disabled={saving} onClick={onMenu}>В главное меню</button>
  </div>
  <div className={k.resultSecondary}><button disabled={saving||!saved} onClick={onRematch}>Ещё один бой</button><button disabled={saving} onClick={onDeck}>Изменить колоду</button></div>
 </KingdomDialog>;
}
