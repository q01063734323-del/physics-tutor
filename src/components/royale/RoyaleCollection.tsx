'use client';
import { lazy, Suspense, useRef, useState, type DragEvent } from 'react';
import { availableCards, averageCost, cardIds, cards, isCardId, isSpell, levelScale, starterDeck, validDeck, type CardId } from '@/lib/royale/config';
import { upgradeCost, type RoyaleProfile } from '@/lib/royale/progress';
import type { KingdomQuality } from '@/lib/royale/quality';
import { CardArtwork } from './CardArtwork';
import { CollectionGlyph, type CollectionIcon } from './CollectionGlyph';
import css from './CollectionDetail.module.css';

const Showcase=lazy(()=>import('./CollectionShowcase'));
const slots=starterDeck.length;
const rarities=Array.from(new Set(cardIds.map(id=>cards[id].rarity)));
const number=new Intl.NumberFormat('ru-RU',{maximumFractionDigits:2});
const transfer='application/x-physics-royale-card';
type Filter='all'|'owned'|'deck';
type Props={profile:RoyaleProfile;deck:CardId[];setDeck:(deck:CardId[])=>void;busy:boolean;save:()=>void;
 upgrade:(card:CardId)=>void;quality:KingdomQuality;initialDeck?:boolean};

function cardStats(id:CardId,level:number){
 const card=cards[id],scale=levelScale(level);
 const rows:{label:string;value:string|number;icon:CollectionIcon}[]=[
  {label:'Энергия',value:card.cost,icon:'energy'},
  {label:'Урон',value:Math.round(card.damage*scale),icon:'swords'},
 ];
 if(card.hp)rows.push({label:'Здоровье',value:Math.round(card.hp*scale),icon:'heart'});
 if(card.range)rows.push({label:'Дальность',value:card.range,icon:'target'});
 if(card.speed)rows.push({label:'Скорость',value:card.speed,icon:'speed'});
 if(card.cooldown)rows.push({label:'Интервал атаки',value:number.format(card.cooldown)+' с',icon:'clock'});
 rows.push({label:'Цели',value:card.targets==='all'?'Земля и воздух':card.targets==='ground'?'Земля':'Здания',icon:'target'});
 if(card.count>1)rows.push({label:'Размер отряда',value:card.count,icon:'deck'});
 if(card.armor)rows.push({label:'Броня',value:number.format(card.armor*100)+'%',icon:'shield'});
 if(card.splash)rows.push({label:'Радиус урона',value:card.splash,icon:'target'});
 if(card.slow)rows.push({label:'Замедление',value:number.format(card.slow)+' с',icon:'clock'});
 if(card.lifetime)rows.push({label:'Время на поле',value:number.format(card.lifetime)+' с',icon:'clock'});
 if(card.charge)rows.push({label:'Множитель рывка',value:'×'+number.format(card.charge),icon:'speed'});
 return rows;
}

export function RoyaleCollection({profile,deck,setDeck,busy,save,upgrade,quality,initialDeck}:Props){
 const [selected,setSelected]=useState<CardId>('knight');
 const [editing,setEditing]=useState(Boolean(initialDeck));
 const [showClips,setShowClips]=useState(false);
 const [filtersOpen,setFiltersOpen]=useState(false);
 const [filter,setFilter]=useState<Filter>('all');
 const [rarity,setRarity]=useState('');
 const [query,setQuery]=useState('');
 const [replacing,setReplacing]=useState(false);
 const [dragSlot,setDragSlot]=useState<number|null>(null);
 const editor=useRef<HTMLElement>(null);
 const stage=useRef<HTMLDivElement>(null);
 const owned=availableCards(profile.xp),card=cards[selected],level=profile.levels[selected];
 const unlocked=owned.includes(selected),chosen=deck.includes(selected);
 const valid=validDeck(deck)&&deck.every(id=>owned.includes(id));
 const changed=deck.length!==profile.deck.length||deck.some((id,index)=>id!==profile.deck[index]);
 const phrase=query.trim().toLocaleLowerCase('ru');
 const visible=cardIds.filter(id=>{
  const item=cards[id];
  return (!phrase||[item.name,item.description].some(text=>text.toLocaleLowerCase('ru').includes(phrase)))&&
   (!rarity||item.rarity===rarity)&&(filter==='all'||filter==='owned'&&owned.includes(id)||filter==='deck'&&deck.includes(id));
 });
 const displayType=isSpell(selected)?'Заклинание':card.building?'Сооружение':card.flying?'Воздушный боец':card.count>1?'Отряд':'Боец';
 function reveal(element:HTMLElement|null){
  if(matchMedia('(max-width: 950px)').matches)element?.scrollIntoView({block:'nearest',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
 }
 function pick(id:CardId){setSelected(id);setReplacing(false);}
 function assign(index:number,id:CardId){
  if(busy||!owned.includes(id)||index<0||index>=slots)return;
  const next=[...deck],previous=next.indexOf(id);
  const target=Math.min(index,next.length);
  if(previous===target)return;
  if(previous!==-1){
   if(target===next.length){next.splice(previous,1);next.push(id);}
   else [next[previous],next[target]]=[next[target],next[previous]];
  }else if(target===next.length){next.push(id);}
  else next[target]=id;
  setDeck(next);setReplacing(false);
 }
 function drop(event:DragEvent,index:number){
  const id=event.dataTransfer.getData(transfer);
  if(!isCardId(id))return;
  event.preventDefault();assign(index,id);setDragSlot(null);
 }
 function beginDrag(event:DragEvent,id:CardId){
  event.dataTransfer.setData(transfer,id);event.dataTransfer.effectAllowed='copyMove';
 }
 function edit(){
  setEditing(value=>!value);setReplacing(false);
 }
 function useSelected(){
  if(!unlocked||busy)return;
  setEditing(true);reveal(editor.current);
  if(chosen)setDeck(deck.filter(id=>id!==selected));
  else if(deck.length<slots)assign(deck.length,selected);
  else setReplacing(true);
 }
 return <section className={css.collection} aria-labelledby="kingdom-collection">
  <section className={css.roster} aria-labelledby="kingdom-collection">
   <header className={css.rosterHeader}>
    <span className={css.sectionLine}>Фигуры и заклинания</span>
    <h1 id="kingdom-collection">Коллекция</h1>
    <span className={css.unlocked}>{owned.length} / {cardIds.length} открыто</span>
   </header>
   <div className={css.filters}>
    <label className={css.search}><CollectionGlyph name="search"/><input type="search" aria-label="Найти карту" placeholder="Поиск персонажа…" value={query} onChange={event=>setQuery(event.target.value)}/></label>
    <label className={css.category}><span className={css.visuallyHidden}>Показать карты</span>
     <select aria-label="Показать карты" value={filter} onChange={event=>setFilter(event.target.value as Filter)}><option value="all">Все карты</option><option value="owned">Открытые</option><option value="deck">В колоде</option></select>
    </label>
    <button type="button" className={css.filterToggle} aria-expanded={filtersOpen} aria-controls="collection-rarity" aria-label="Фильтр по редкости" onClick={()=>setFiltersOpen(value=>!value)}><CollectionGlyph name="filter"/></button>
   </div>
   <div id="collection-rarity" className={css.rarityFilter} hidden={!filtersOpen}><label>Редкость <select aria-label="Редкость" value={rarity} onChange={event=>setRarity(event.target.value)}><option value="">Любая</option>{rarities.map(value=><option key={value}>{value}</option>)}</select></label></div>
   {visible.length===0&&<p role="status">По этим фильтрам нет карт.</p>}
   <div className={css.cards} aria-label="Карточки коллекции">
    {visible.map(id=><button type="button" className={css.card} data-card={id} key={id} aria-pressed={selected===id}
     aria-label={cards[id].name} onClick={()=>pick(id)} draggable={editing&&!busy&&owned.includes(id)} onDragStart={event=>beginDrag(event,id)} onDragEnd={()=>setDragSlot(null)}>
     <CardArtwork id={id}/><span className={css.cost}>{cards[id].cost}</span>
     {!owned.includes(id)&&<span className={css.lock}><CollectionGlyph name="shield"/>{cards[id].unlockXp} XP</span>}
     <span className={css.cardLabel}><strong>{cards[id].name}</strong><small>Ур. {profile.levels[id]}</small></span>
    </button>)}
   </div>
  </section>
  <div className={css.stageRegion} ref={stage}>
   <Suspense fallback={<p className={css.loading} role="status">Открываем научный зал…</p>}>
    <Showcase key={quality} id={selected} name={card.name} quality={quality} showClips={showClips}/>
   </Suspense>
  </div>
  <aside className={css.inspector} aria-label={'Характеристики · '+card.name}>
   <div className={css.inspectorBody} key={selected} data-card-details={selected}>
    <header className={css.characterName}><span className={css.cost}>{card.cost}</span><h2>{card.name}</h2></header>
    <div className={css.grade}><CollectionGlyph name="atom"/>{card.rarity} <span>·</span> {displayType}</div>
    <p>{card.description}</p>
    <dl className={css.stats}>
     {cardStats(selected,level).map(({label,value,icon})=><div key={label}><dt><CollectionGlyph name={icon}/>{label}</dt><dd>{typeof value==='number'?number.format(value):value}</dd></div>)}
    </dl>
    <button type="button" className={css.training} onClick={()=>{setShowClips(value=>!value);reveal(stage.current);}} aria-expanded={showClips}><CollectionGlyph name="play"/>{showClips?'Скрыть анимации':'3D-просмотр'}</button>
    <div className={css.characterActions}>
     <button type="button" onClick={useSelected} disabled={busy||!unlocked}>{!unlocked?'Откроется за '+card.unlockXp+' XP':chosen?'Убрать из колоды':deck.length<slots?'Добавить в колоду':'Заменить карту'}</button>
     {unlocked&&<button type="button" onClick={()=>upgrade(selected)} disabled={busy||level>=5||profile.coins<upgradeCost(level)}>{level>=5?'Максимальный уровень':'Улучшить · '+upgradeCost(level)+' монет'}</button>}
    </div>
   </div>
  </aside>
  <section className={css.deck} ref={editor} aria-labelledby="kingdom-deck">
   <div className={css.deckInner}>
    <header className={css.deckHead}>
     <h2 id="kingdom-deck"><CollectionGlyph name="swords"/>Моя колода</h2>
     <button type="button" aria-expanded={editing} aria-label={'Колода · '+deck.length+'/'+slots} onClick={edit}>{editing?'Закрыть редактор':'Редактировать'} <span>{deck.length}/{slots}</span></button>
     {editing&&<button type="button" className={css.save} disabled={busy||!valid||!changed} onClick={save}>Сохранить колоду</button>}
    </header>
    {editing&&(replacing||!valid)&&<p className={css.deckHint} role="status">{replacing?'Выберите слот для карты «'+card.name+'».':'Нужны восемь разных открытых карт. Пока используется сохранённая колода.'}</p>}
    <ol className={css.deckSlots} aria-label="Слоты колоды">
     {Array.from({length:slots},(_,index)=>{
      const id=deck[index];
      return <li key={index} data-target={dragSlot===index||replacing}
       onDragOver={event=>{if(editing&&!busy&&event.dataTransfer.types.includes(transfer)){event.preventDefault();setDragSlot(index);}}}
       onDragLeave={event=>{if(!event.currentTarget.contains(event.relatedTarget as Node|null))setDragSlot(null);}}
       onDrop={event=>drop(event,index)}>
       <button type="button" className={css.deckCard} aria-label={replacing?'Заменить слот '+(index+1):id?cards[id].name:'Пустой слот '+(index+1)}
        aria-pressed={Boolean(id&&id===selected)&&!replacing} draggable={Boolean(id&&editing&&!busy)} onDragStart={event=>{if(id)beginDrag(event,id);}}
        onDragEnd={()=>setDragSlot(null)} onClick={()=>{if(replacing||!id&&editing)assign(index,selected);else if(id)pick(id);}}>
        {id?<><CardArtwork id={id}/><span className={css.cost}>{cards[id].cost}</span></>:<span className={css.empty}>+</span>}
        <span className={css.slotNumber}>{index+1}</span>
       </button>
       {id&&editing&&<div className={css.slotActions}>
        <button type="button" aria-label={'Раньше: '+cards[id].name} disabled={busy||index===0} onClick={()=>assign(index-1,id)}>‹</button>
        <button type="button" aria-label={'Позже: '+cards[id].name} disabled={busy||index+1>=deck.length} onClick={()=>assign(index+1,id)}>›</button>
        <button type="button" aria-label={'Убрать: '+cards[id].name} disabled={busy} onClick={()=>setDeck(deck.filter(item=>item!==id))}>×</button>
       </div>}
      </li>;
     })}
    </ol>
   </div>
   <div className={css.average}><span>Средняя энергия</span><strong><CollectionGlyph name="energy"/>{number.format(Math.round(averageCost(deck)*10)/10)}</strong></div>
  </section>
 </section>;
}
