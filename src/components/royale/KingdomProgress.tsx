import Link from 'next/link';
import { leagues, leagueProgress } from '@/lib/royale/leagues';
import { achievementLabels, type RoyaleProfile } from '@/lib/royale/progress';
import { topicRows } from '@/lib/royale/learning';
import { KingdomMark, LeagueBadge } from './KingdomMarks';
import k from './Kingdom.module.css';

export function KingdomProgress({profile,topics,onBattle}:{profile:RoyaleProfile;topics:string[];onBattle:()=>void}){
 const stage=leagueProgress(profile.trophies);
 const rows=topicRows(profile.topics,topics);
 const stable=rows.filter(row=>row.attempts>=3&&row.percent>=80);
 return <section className={k.pane} aria-labelledby="kingdom-progress">
  <header className={k.paneHeading}><div><span className={k.kicker}>Лиги и знания</span><h1 id="kingdom-progress">Путь развития</h1></div></header>
  <div className={k.road}>
   <div className={k.roadIntro}><LeagueBadge {...stage.current}/><div><span className={k.kicker}>Текущая лига</span><h2>{stage.current.name}</h2>
    <p>{stage.next?`До лиги «${stage.next.name}» · ${stage.next.trophies-profile.trophies} кубков`:'Вы достигли высшей лиги.'}</p></div></div>
   <ol className={k.leagueList}>{leagues.map((league,index)=><li key={league.name} data-stage={index===stage.index?'current':index<stage.index?'reached':'ahead'} aria-current={index===stage.index?'step':undefined}>
    <LeagueBadge {...league}/><span className={k.roadPoint}/><b>{league.name}</b><span>{league.trophies.toLocaleString('ru-RU')} кубков</span>
   </li>)}</ol>
   <div className={k.roadStatus}><b>{profile.trophies.toLocaleString('ru-RU')} кубков</b>
    <progress aria-label="Прогресс до следующей лиги" max={100} value={stage.percent}/>
    <button className={k.goldButton} onClick={onBattle}>К битве</button>
   </div>
  </div>
  <div className={k.progressColumns}>
   <section className={k.panel}><h2>Освоение физики</h2><strong className={k.largeNumber}>{stable.length} <small>/ {topics.length} тем</small></strong>
    <p>Уверенная тема — от трёх проверенных ответов и точность от 80%.</p>
    {rows.length>0?<ul className={k.progressTopics}>{rows.slice().sort((a,b)=>b.percent-a.percent||b.attempts-a.attempts).slice(0,5).map(row=><li key={row.topic}><span>{row.topic}</span><b>{row.percent}%</b></li>)}</ul>:<p>Разбор по темам появится после проверенных ответов в бою.</p>}
    <Link href="/trainer">Открыть тренажёр ЕГЭ ↗</Link>
   </section>
   <section className={k.panel}><h2>Достижения</h2>
    <ul className={k.achievements}>{Object.entries(achievementLabels).map(([id,name])=><li key={id} data-earned={profile.achievements.includes(id)}>
     <KingdomMark name={profile.achievements.includes(id)?'crown':'spark'}/><div><b>{name}</b><span>{profile.achievements.includes(id)?'Получено':'Впереди'}</span></div>
    </li>)}</ul>
   </section>
  </div>
 </section>;
}
