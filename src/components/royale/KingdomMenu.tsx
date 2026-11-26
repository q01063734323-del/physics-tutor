/* eslint-disable @next/next/no-img-element -- Local game icon and arena artwork. */
'use client';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { arenas, difficultyLabels, type Difficulty } from '@/lib/royale/config';
import type { RoyaleProfile } from '@/lib/royale/progress';
import { leagueProgress } from '@/lib/royale/leagues';
import { playerLevel } from '@/lib/royale/progress';
import { accuracy,topicRows } from '@/lib/royale/learning';
import { CardArtwork } from './CardArtwork';
import { KingdomMark, LeagueBadge } from './KingdomMarks';
import { KingdomScene } from './KingdomScene';
import { RoyaleIcon } from './RoyaleIcon';
import type { Preferences } from './RoyalePreferences';
import k from './Kingdom.module.css';

export const kingdomTabs = [
 ['collection','Коллекция'],['battle','Битва'],['progress','Путь развития'],['stats','Статистика'],
] as const;
export type KingdomTab = 'home' | typeof kingdomTabs[number][0];
const ru = new Intl.NumberFormat('ru-RU');

export function KingdomShell({tab,profile,practice,name,onNavigate,onSettings,children}:{
 tab:KingdomTab; profile:RoyaleProfile|null; practice:boolean; name?:string|null;
 onNavigate:(tab:KingdomTab)=>void; onSettings:()=>void; children:ReactNode;
}){
 const league=profile?leagueProgress(profile.trophies).current:null;
 return <main className={k.shell} data-tab={tab}>
  <div className={k.app}>
   <header className={k.topbar}>
    <button type="button" onClick={()=>onNavigate('home')} className={k.brand} aria-label="Главное меню Physics Royale">
     <span><KingdomMark name="atom" size={31}/></span><b>PHYSICS <em>ROYALE</em></b>
    </button>
    {profile&&league&&<div className={k.player} aria-label="Профиль игрока">
     <div className={k.avatar}><CardArtwork id="knight"/></div>
     <div><b>{name||'Игрок'}</b><small>Уровень {playerLevel(profile.xp)} · {league.name}</small></div>
    </div>}
    <div className={k.topRight}>
     {profile&&<><span className={k.currency} data-new={profile.trophies!==0}><img src="/royale/trophy.svg" alt=""/><b key={profile.trophies}>{ru.format(profile.trophies)}</b><span className={k.srOnly}>кубков</span></span>
      <span className={k.currency} data-currency="coins"><i>✦</i><b>{ru.format(profile.coins)}</b><span className={k.srOnly}>монет</span></span></>}
     <button type="button" className={k.iconButton} onClick={onSettings} aria-label="Настройки Physics Royale"><RoyaleIcon name="settings"/></button>
    </div>
   </header>
   <div className={k.content}>{children}</div>
   <nav className={k.navigation} aria-label="Разделы игры">
    {kingdomTabs.map(([id,label])=><button type="button" key={id} aria-current={tab===id?'page':undefined} onClick={()=>onNavigate(id)}>
     {id==='stats'?<KingdomMark name="stats"/>:<RoyaleIcon name={id==='battle'?'swords':id==='collection'?'deck':'progress'}/>}<span>{label}</span></button>)}
   </nav>
   <footer className={k.footer}><span>{practice?'Локальная практика':'Личный профиль'}</span><Link href="/trainer">Тренажёр ЕГЭ</Link><Link href="/">Физика с Егором</Link></footer>
  </div>
 </main>;
}

export function KingdomHome({profile,topics,preferences,ready,action,showSettings,launching}:{profile:RoyaleProfile;topics:string[];
 preferences:Preferences;ready:boolean;action:ReactNode;showSettings:()=>void;launching:boolean}){
 const {current,next,percent}=leagueProgress(profile.trophies);
 const rows=topicRows(profile.topics,topics);
 const recommendation=rows.filter(row=>row.correct<row.attempts).sort((a,b)=>a.percent-b.percent||b.attempts-a.attempts)[0];
 const percentCorrect=accuracy(profile.attempts,profile.correct);
 return <section className={k.court} data-launching={launching} aria-labelledby="kingdom-title">
  <div className={k.courtMist} aria-hidden="true"/>
  <header className={k.courtHeading}><span className={k.courtCrown}><KingdomMark name="crown" size={33}/></span>
   <h1 id="kingdom-title">Physics <em>Royale</em></h1>

  </header>
  {ready&&<KingdomScene key={preferences.quality} quality={preferences.quality}/>}
  <aside className={k.courtLeague}><LeagueBadge {...current}/><div><small>Ваша лига</small><b>{current.name}</b>
   <span>{next?`${ru.format(profile.trophies)} / ${ru.format(next.trophies)} кубков`:'Высшая лига'}</span>
   <progress aria-label="Прогресс лиги" max={100} value={percent}/></div></aside>
  <aside className={k.courtLearning}><div className={k.learningIcon}><KingdomMark name="atom"/></div><div><small>Физика в бою</small>
   <b>{percentCorrect===null?'Первые задачи':percentCorrect+'% точность'}</b>
   <span>{recommendation?'Повторить · '+recommendation.topic:profile.attempts?`${profile.correct} верных ответов`:'Энергия за верные ответы'}</span></div>
  </aside>
  <div className={k.courtActions}>{action}<button type="button" className={k.heroLink} onClick={showSettings}>Выбрать арену и сложность <span aria-hidden="true">↗</span></button></div>
 </section>;
}

export function KingdomBattleSetup({profile,arena,setArena,difficulty,setDifficulty,fixed,preferences,updatePreferences,action,onDeck}: {
 profile:RoyaleProfile;arena:string;setArena:(id:string)=>void;difficulty:Difficulty;setDifficulty:(value:Difficulty)=>void;
 fixed:boolean;preferences:Preferences;updatePreferences:(patch:Partial<Preferences>)=>void;action:ReactNode;onDeck:()=>void;
}){
 return <section className={k.pane} aria-labelledby="kingdom-battle">
  <header className={k.paneHeading}><div><span className={k.kicker}>Подготовка к матчу</span><h1 id="kingdom-battle">Битва</h1></div><button className={k.subButton} onClick={onDeck}><RoyaleIcon name="deck"/>Изменить колоду</button></header>
  <div className={k.battleLayout}>
   <section aria-label="Арены" className={k.arenaChoices}>{arenas.map(item=>{
    const locked=profile.trophies<item.trophies;
    return <button key={item.id} type="button" disabled={locked} aria-pressed={arena===item.id} onClick={()=>setArena(item.id)}>
     <img src={'/royale/arena-'+item.id+'.svg'} alt=""/><span><strong>{item.name}</strong><small>{locked?`${item.trophies} кубков для открытия`:item.description}</small></span>
     <RoyaleIcon name={locked?'lock':'shield'}/>
    </button>;
   })}</section>
   <aside className={k.panel}><h2>Следующий бой</h2><p>{arenas.find(item=>item.id===arena)?.name}</p>
    <label className={k.field}>Сложность <select value={difficulty} disabled={fixed} onChange={event=>setDifficulty(event.target.value as Difficulty)}>{Object.entries(difficultyLabels).map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></label>
    <label className={k.field}>Качество графики <select value={preferences.quality} onChange={event=>updatePreferences({quality:event.target.value as Preferences['quality']})}>
     <option value="auto">Автоматически</option><option value="high">High · высокое</option><option value="medium">Medium · среднее</option><option value="low">Low · экономное</option>
    </select></label>
    <div className={k.energyCallout}><RoyaleIcon name="energy"/><p>Верные ответы пополняют энергию. Она нужна для разыгрывания карт.</p></div>
    {action}
   </aside>
  </div>
 </section>;
}
