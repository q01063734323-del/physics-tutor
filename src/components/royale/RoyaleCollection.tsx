'use client';
import { lazy, Suspense, useRef, useState } from 'react';
import { cardIds, cards, availableCards, averageCost, type CardId } from '@/lib/royale/config';
import { upgradeCost, type RoyaleProfile } from '@/lib/royale/progress';
import type { GraphicsQuality } from '@/lib/royale/quality';
import { CardArtwork } from './CardArtwork';
import { KingdomDialog } from './KingdomDialog';
import { KingdomMark } from './KingdomMarks';
import { RoyaleIcon } from './RoyaleIcon';
import k from './Kingdom.module.css';

const Viewer = lazy(()=>import('./KingdomPreview'));
type Props={profile:RoyaleProfile;deck:CardId[];setDeck:(deck:CardId[])=>void;busy:boolean;save:()=>void;
 upgrade:(card:CardId)=>void;quality:GraphicsQuality;initialDeck?:boolean};

export function RoyaleCollection({profile,deck,setDeck,busy,save,upgrade,quality,initialDeck}:Props){
 const [selected,setSelected]=useState<CardId>('knight'), [view,setView]=useState(false);
 const [deckOpen,setDeckOpen]=useState(Boolean(initialDeck)), [filter,setFilter]=useState<'all'|'owned'|'deck'>('all');
 const [query,setQuery]=useState('');
 const details=useRef<HTMLElement>(null);
 function pick(id:CardId){
  setSelected(id);
  if(matchMedia('(max-width: 620px)').matches)details.current?.scrollIntoView({block:'start',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
 }
 const owned=availableCards(profile.xp);
 const complete=deck.length===8&&new Set(deck).size===8;
 const visible=cardIds.filter(id=>(!query.trim()||[cards[id].name,cards[id].description,cards[id].rarity].join(' ').toLocaleLowerCase('ru').includes(query.trim().toLocaleLowerCase('ru')))&&(filter==='all'||filter==='owned'&&owned.includes(id)||filter==='deck'&&deck.includes(id)));
 const card=cards[selected], level=profile.levels[selected], unlocked=owned.includes(selected), chosen=deck.includes(selected);
 const scale=1+.04*(level-1);
 const targets=card.targets==='all'?'Земля и воздух':card.targets==='buildings'?'Здания':'Земля';
 const move=(index:number,delta:number)=>{
  const next=[...deck],other=index+delta;
  if(other<0||other>=next.length)return;
  [next[index],next[other]]=[next[other],next[index]];setDeck(next);
 };
 return <section className={k.pane} aria-labelledby="kingdom-collection">
  <header className={k.paneHeading}><div><span className={k.kicker}>Фигуры и заклинания</span><h1 id="kingdom-collection">Коллекция</h1></div>
   <button className={k.subButton} type="button" aria-expanded={deckOpen} onClick={()=>setDeckOpen(!deckOpen)}><RoyaleIcon name="deck"/>Колода · {deck.length}/8</button>
  </header>
  {deckOpen&&<section className={k.deckEditor} aria-labelledby="kingdom-deck">
   <div className={k.sectionHead}><div><h2 id="kingdom-deck">Боевая колода</h2><p>Первые четыре карты — стартовая рука. Средняя стоимость {averageCost(deck).toFixed(1)}.</p></div>
    <button type="button" className={k.goldButton} disabled={busy||!complete} onClick={save}>Сохранить колоду</button></div>
   {!complete&&<p role="status">Выберите восемь открытых карт. До сохранения используется прежняя колода.</p>}
   <ol className={k.deckSlots}>{deck.map((id,index)=><li key={id}>
    <button className={k.deckArt} type="button" aria-label={cards[id].name} onClick={()=>pick(id)}><CardArtwork id={id}/><span>{index+1}</span></button>
    <b>{cards[id].name}</b>
    <div><button aria-label={'Раньше: '+cards[id].name} onClick={()=>move(index,-1)} disabled={busy||index===0}>‹</button>
     <button aria-label={'Позже: '+cards[id].name} onClick={()=>move(index,1)} disabled={busy||index===deck.length-1}>›</button>
     <button aria-label={'Убрать: '+cards[id].name} onClick={()=>setDeck(deck.filter(item=>item!==id))} disabled={busy}>×</button></div>
   </li>)}</ol>
  </section>}
  <div className={k.collectionLayout}>
   <div className={k.roster}>
    <div className={k.filters}>
     <div aria-label="Показать карты">{([['all','Все '+cardIds.length],['owned','Открытые '+owned.length],['deck','В колоде '+deck.length]] as const).map(([id,label])=><button type="button" aria-pressed={filter===id} onClick={()=>setFilter(id)} key={id}>{label}</button>)}</div>
     <input type="search" aria-label="Найти карту" placeholder="Найти карту" value={query} onChange={event=>setQuery(event.target.value)}/>
    </div>
    {visible.length===0&&<p role="status">По этим фильтрам нет карт.</p>}
    <div className={k.cards}>{visible.map(id=><button type="button" className={k.card} aria-pressed={selected===id} onClick={()=>pick(id)} key={id}>
     <span className={k.cardCost}>{cards[id].cost}</span><CardArtwork id={id}/>
     {!owned.includes(id)&&<span className={k.cardLock}><RoyaleIcon name="lock"/><span>{cards[id].unlockXp} XP</span></span>}
     <span className={k.cardName}>{cards[id].name}</span>
    </button>)}</div>
   </div>
   <aside ref={details} className={k.character} aria-label={'Характеристики · '+card.name}>
    <div className={k.characterPortrait}><CardArtwork id={selected}/></div>
    <div className={k.characterInfo}>
     <div className={k.characterTitle}><span className={k.cardCost}>{card.cost}</span><div><small>{card.rarity} · уровень {level}</small><h2>{card.name}</h2></div></div>
     <p>{card.description}</p>
     <dl className={k.characterStats}>
      {([['Здоровье',card.hp?Math.round(card.hp*scale):'—'],['Урон',Math.round(card.damage*scale)],['Скорость',card.speed],
        ['Дальность',card.range],['Интервал атаки',card.cooldown?card.cooldown+' с':'—'],['Цели',targets],['Размер отряда',card.count||'Заклинание']] as const)
       .map(([name,value])=><div key={name}><dt>{name}</dt><dd>{value}</dd></div>)}
     </dl>
     <button type="button" className={k.violetButton} onClick={()=>setView(true)}><KingdomMark name="cube"/>3D-просмотр</button>
     <div className={k.characterActions}>
      <button disabled={busy||!unlocked||(!chosen&&deck.length>=8)} onClick={()=>{setDeck(chosen?deck.filter(id=>id!==selected):[...deck,selected]);setDeckOpen(true);}}>{!unlocked?'Откроется за '+card.unlockXp+' XP':chosen?'Убрать из колоды':'Добавить в колоду'}</button>
      {unlocked&&<button disabled={busy||level>=5||profile.coins<upgradeCost(level)} onClick={()=>upgrade(selected)}>{level>=5?'Максимальный уровень':'Улучшить · '+upgradeCost(level)+' монет'}</button>}
     </div>
    </div>
   </aside>
  </div>
  {view&&<KingdomDialog title={'3D-просмотр · '+card.name} onClose={()=>setView(false)} kind="preview">
   <header className={k.dialogHead}><h2>{card.name}</h2><button className={k.iconButton} onClick={()=>setView(false)} aria-label="Закрыть просмотр">×</button></header>
   <Suspense fallback={<p role="status">Открываем 3D-просмотр…</p>}><Viewer key={selected+quality} id={selected} quality={quality}/></Suspense>
  </KingdomDialog>}
 </section>;
}
