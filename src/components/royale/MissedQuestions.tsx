import {useState} from 'react';
import {MathText} from '../QuestionTrainer';
import SourceScan from '../SourceScan';
import {royaleRequest} from '@/lib/royale/client';
import type {VerifiedAnswer} from '@/lib/royale/progress';
import type {TrainerCheckResult} from '@/lib/trainer-public';
import {displayTrainerAnswer} from '@/lib/trainer-bank';
import type {GameTask} from './types';
import s from './Royale.module.css';

function RepeatQuestion({question}:{question:GameTask}){
 const [answer,setAnswer]=useState('');
 const [result,setResult]=useState<TrainerCheckResult>();
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 return <details className={s.repeatQuestion}>
  <summary>{question.section} · № {question.source.taskLabel}</summary>
  <p><MathText text={question.prompt}/></p>
  {question.assets.filter(asset=>asset.role==='scan'||asset.role==='diagram').map(asset=><SourceScan key={asset.id} src={asset.url} alt={asset.alt}/>)}
  <form onSubmit={async event=>{
   event.preventDefault();if(!answer.trim()||busy)return;
   setBusy(true);setError('');
   try{const response=await royaleRequest<{result:TrainerCheckResult}>(null,{action:'practice-answer',questionId:question.id,answer});setResult(response.result);}
   catch(problem){setError(problem instanceof Error?problem.message:'Проверка временно недоступна.');}
   finally{setBusy(false);}
  }}>
   <label>{question.answer?.type==='numeric'&&question.answer.unit?`Ответ (${question.answer.unit})`:'Ответ'}<input value={answer} maxLength={128} inputMode={question.answer?.type==='numeric'?'decimal':'text'} onChange={event=>{setAnswer(event.target.value);setResult(undefined);}}/></label>
   <button type="submit" disabled={busy||!answer.trim()}>{busy?'Проверяем…':'Проверить ещё раз'}</button>
  </form>
  {result&&<div className={result.correct?s.correct:s.incorrect} role="status"><strong>{result.correct?'Верно!':'Пока неверно'}</strong><p>{result.feedback}</p><p>Ответ · {displayTrainerAnswer(result.answer)}</p>{result.solution&&<p><MathText text={result.solution}/></p>}{result.assets.map(asset=><SourceScan key={asset.id} src={asset.url} alt={asset.alt}/>)}</div>}
  {error&&<p role="alert">{error}</p>}
 </details>;
}

export function MissedQuestions({catalog,answers}:{catalog:GameTask[];answers:VerifiedAnswer[]}){
 const last=new Map(answers.flatMap(answer=>answer.questionId?[[answer.questionId,answer.correct] as const]:[]));
 const missed=catalog.filter(question=>last.get(question.id)===false);
 if(!missed.length)return null;
 return <section className={s.missed}><h2>Повторить ошибки</h2>{missed.map(question=><RepeatQuestion key={question.id} question={question}/>)}</section>;
}
