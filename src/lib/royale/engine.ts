import {balance,cards,starterDeck,isSpell,validDeck,levelScale,type CardId,type Difficulty,type Side}from'./config';
export type Unit={id:number;side:Side;card:CardId;x:number;y:number;hp:number;maxHp:number;attackAt:number;hitAt:number;level:number;lane:number;facing:number;lastAttack:number;slowUntil:number;bornAt:number;chargeReady:boolean;travelled:number};
export type Tower={id:number;side:Side;kind:'king'|'guard';x:number;y:number;hp:number;maxHp:number;attackAt:number;hitAt:number;radius:number};
export type Projectile={id:number;side:Side;fromX:number;fromY:number;x:number;y:number;toX:number;toY:number;targetId:number|null;damage:number;splash:number;start:number;end:number;kind:'arrow'|'fire'|'comet'|'ice';buildingScale:number;slow:number};
export type Effect={id:number;x:number;y:number;kind:'hit'|'spawn'|'collapse'|'fire';at:number;side:Side;card?:CardId};
export type GameCommand={tick:number;kind:'deploy';card:CardId;x:number;y:number}|{tick:number;kind:'reward';id:string;amount:number};
export type Battle={version:number;seed:number;tick:number;nextId:number;difficulty:Difficulty;energy:number;botEnergy:number;hand:CardId[];queue:CardId[];botHand:CardId[];botQueue:CardId[];units:Unit[];towers:Tower[];projectiles:Projectile[];effects:Effect[];rewardIds:string[];played:Partial<Record<CardId,number>>;levels:Partial<Record<CardId,number>>;result:'win'|'loss'|'draw'|null;botNextAt:number;lastBotLane:number;lastBotCard:CardId|null;damage:{player:number;bot:number}};
export const enemy=(side:Side):Side=>side==='player'?'bot':'player';
const clamp=(n:number,a:number,b:number)=>Math.max(a,Math.min(b,n));
const distance=(a:{x:number;y:number},b:{x:number;y:number})=>Math.hypot(a.x-b.x,a.y-b.y);
function random(state:Battle){let x=state.seed|0;x^=x<<13;x^=x>>>17;x^=x<<5;state.seed=x>>>0;return (state.seed>>>0)/4294967296;}
function effect(state:Battle,x:number,y:number,kind:Effect['kind'],side:Side,card?:CardId){state.effects.push({id:state.nextId++,x,y,kind,at:state.tick,side,...(card?{card}:{})});}
function botDeck(seed:number,difficulty:Difficulty):CardId[]{if(difficulty==='novice')return starterDeck;const decks:CardId[][]=[['sentinel','spears','rider','ember','dragon','frost','meteor','hunters'],['giant','archers','skeletons','ballista','frost','mage','fireball','guardians'],['rider','hunters','sentinel','spears','ballista','ember','dragon','fireball']];return decks[(seed>>>0)%decks.length];}
export function createBattle(seed:number,difficulty:Difficulty='novice',deck:CardId[]=starterDeck,levels:Battle['levels']={}):Battle{
 if(!validDeck(deck))throw Error('Нужна колода из восьми разных карт.');
 const state:Battle={version:balance.version,seed:seed||1,tick:0,nextId:10,difficulty,energy:balance.startEnergy,botEnergy:balance.startEnergy,hand:deck.slice(0,4),queue:deck.slice(4),botHand:botDeck(seed,difficulty).slice(0,4),botQueue:botDeck(seed,difficulty).slice(4),units:[],towers:[],projectiles:[],effects:[],rewardIds:[],played:{},levels:{...levels},result:null,botNextAt:60,lastBotLane:110,lastBotCard:null,damage:{player:0,bot:0}};
 for(const side of ['player','bot'] as Side[]){const y=side==='player'?594:126;for(const x of [110,310])state.towers.push({id:state.nextId++,side,kind:'guard',x,y,hp:balance.tower.guardHp,maxHp:balance.tower.guardHp,attackAt:0,hitAt:-100,radius:27});state.towers.push({id:state.nextId++,side,kind:'king',x:210,y:side==='player'?658:62,hp:balance.tower.kingHp,maxHp:balance.tower.kingHp,attackAt:0,hitAt:-100,radius:33});}return state;
}
export function canPlace(state:Battle,card:CardId,x:number,y:number,side:Side='player'){
 if(state.result || !Number.isFinite(x)||!Number.isFinite(y)||x<18||x>402||y<18||y>702)return false;
 if(isSpell(card))return true;
 if(side==='player'?y<balance.riverBottom+18:y>balance.riverTop-18)return false;
 return !state.towers.some(t=>t.hp>0&&distance(t,{x,y})<t.radius+cards[card].radius+3)&&!state.units.some(u=>u.hp>0&&cards[u.card].building&&distance(u,{x,y})<cards[u.card].radius+cards[card].radius+4);
}
function spendAndDeploy(state:Battle,side:Side,card:CardId,x:number,y:number){
 const hand=side==='player'?state.hand:state.botHand,queue=side==='player'?state.queue:state.botQueue,energy=side==='player'?state.energy:state.botEnergy,definition=cards[card],index=hand.indexOf(card);
 if(index<0||energy<definition.cost||!canPlace(state,card,x,y,side)||state.units.length+definition.count>balance.maxUnits)return false;
 if(side==='player'){state.energy-=definition.cost;state.played[card]=(state.played[card]||0)+1;}else state.botEnergy-=definition.cost;
 hand[index]=queue.shift()!;queue.push(card);
 if(isSpell(card)){state.projectiles.push({id:state.nextId++,side,fromX:210,fromY:side==='player'?684:36,x:210,y:side==='player'?684:36,toX:x,toY:y,targetId:null,damage:definition.damage*levelScale(side==='player'?state.levels[card]||1:1),splash:definition.splash!,start:state.tick,end:state.tick+(card==='meteor'?24:14),kind:'comet',buildingScale:.35,slow:0});return true;}
 for(let n=0;n<definition.count;n++){
  const offset=definition.count===1?0:(n-(definition.count-1)/2)*(definition.radius*2+3);let ux=clamp(x+offset,18,402),uy=clamp(y+(n%2)*13,18,702);
  for(const t of state.towers)if(t.hp>0&&distance(t,{x:ux,y:uy})<t.radius+definition.radius+3){const angle=Math.atan2(uy-t.y,ux-t.x)||Math.PI/2;ux=t.x+Math.cos(angle)*(t.radius+definition.radius+4);uy=t.y+Math.sin(angle)*(t.radius+definition.radius+4);}
  const level=side==='player'?state.levels[card]||1:1,hp=definition.hp*levelScale(level);state.units.push({id:state.nextId++,side,card,x:clamp(ux,18,402),y:side==='player'?Math.max(balance.riverBottom+18,uy):Math.min(balance.riverTop-18,uy),hp,maxHp:hp,attackAt:state.tick+8,hitAt:-100,level,lane:x<210?110:310,facing:side==='player'?-Math.PI/2:Math.PI/2,lastAttack:-100,slowUntil:0,bornAt:state.tick,chargeReady:Boolean(definition.charge),travelled:0});effect(state,ux,uy,'spawn',side);
 }return true;
}
export function applyCommand(state:Battle,command:GameCommand){
 if(state.result||command.tick!==state.tick)return false;
 if(command.kind==='reward'){
  if(!command.id||command.id.length>128||!Number.isInteger(command.amount)||command.amount<1||command.amount>6||state.rewardIds.includes(command.id))return false;
  state.energy=Math.min(balance.maxEnergy,state.energy+command.amount);state.rewardIds.push(command.id);return true;
 }
 return spendAndDeploy(state,'player',command.card,command.x,command.y);
}
function damage(state:Battle,target:Unit|Tower,amount:number,attacker:Side){
 if(target.hp<=0)return;const armor='card'in target?(cards[target.card].armor||0):0;const actual=Math.min(target.hp,amount*(1-armor));target.hp=Math.max(0,target.hp-actual);target.hitAt=state.tick;state.damage[attacker]+=actual;
 effect(state,target.x,target.y,target.hp<=0?'collapse':'hit',attacker,'card'in target?target.card:undefined);
}
function projectile(state:Battle,from:Unit|Tower,target:Unit|Tower,amount:number,splash=0){
 const ranged='kind'in from||cards[from.card].range>50;
 if(!ranged){damage(state,target,amount,from.side);return;}
 const card='card'in from?from.card:null;state.projectiles.push({id:state.nextId++,side:from.side,fromX:from.x,fromY:from.y,x:from.x,y:from.y,toX:target.x,toY:target.y,targetId:target.id,damage:amount,splash,start:state.tick,end:state.tick+Math.max(3,Math.round(distance(from,target)/20)),kind:card==='frost'?'ice':card==='mage'||card==='dragon'?'fire':'arrow',buildingScale:1,slow:card?cards[card].slow||0:0});
}
function nearestTarget(state:Battle,unit:Unit):Unit|Tower|undefined{
 const card=cards[unit.card],towers=state.towers.filter(t=>t.side!==unit.side&&t.hp>0);
 const units=state.units.filter(u=>u.side!==unit.side&&u.hp>0&&(card.targets==='buildings'?cards[u.card].building:card.targets==='all'||!cards[u.card].flying));
 const nearby=units.filter(u=>cards[u.card].building||distance(unit,u)<Math.max(145,card.range+45));
 const candidates:(Unit|Tower)[]=[...nearby,...towers];return candidates.sort((a,b)=>distance(unit,a)-('radius'in a?a.radius:cards[a.card].radius)-(distance(unit,b)-('radius'in b?b.radius:cards[b.card].radius))||a.id-b.id)[0];
}
function move(state:Battle,unit:Unit,target:Unit|Tower,dt:number){
 const definition=cards[unit.card];if(definition.building)return;let tx=target.x,ty=target.y;
 const separated=(unit.y<balance.riverTop&&target.y>balance.riverTop)||(unit.y>balance.riverBottom&&target.y<balance.riverBottom)||(unit.y>=balance.riverTop&&unit.y<=balance.riverBottom);
 if(!definition.flying&&separated){const bridge=unit.lane,goingDown=target.y>unit.y;if(Math.abs(unit.x-bridge)>balance.bridgeHalf-definition.radius || unit.y<balance.riverTop-3||unit.y>balance.riverBottom+3){tx=bridge;ty=goingDown?balance.riverTop-8:balance.riverBottom+8;if(Math.abs(unit.y-ty)<15&&Math.abs(unit.x-tx)<12)ty=goingDown?balance.riverBottom+12:balance.riverTop-12;}else{tx=bridge;ty=goingDown?balance.riverBottom+14:balance.riverTop-14;}}
 // Route around buildings instead of repeatedly pushing a unit back into its starting point.
 for(const obstacle of [...state.towers,...state.units.filter(u=>u.id!==unit.id&&cards[u.card].building)].sort((a,b)=>distance(unit,a)-distance(unit,b))){
  if(obstacle.hp<=0||obstacle.id===target.id||distance(unit,obstacle)>180)continue;
  const vx=tx-unit.x,vy=ty-unit.y,length2=vx*vx+vy*vy;if(length2<1)continue;
  const along=((obstacle.x-unit.x)*vx+(obstacle.y-unit.y)*vy)/length2;
  const clearance=('radius'in obstacle?obstacle.radius:cards[obstacle.card].radius)+definition.radius+7;
  if(along>0&&along<1&&Math.hypot(unit.x+along*vx-obstacle.x,unit.y+along*vy-obstacle.y)<clearance){
   const side=Math.abs(unit.x-obstacle.x)>2?(unit.x<obstacle.x?-1:1):(unit.lane<210?-1:1);tx=clamp(obstacle.x+side*(clearance+8),18,402);ty=obstacle.y;break;
  }
 }
 const dx=tx-unit.x,dy=ty-unit.y,length=Math.hypot(dx,dy);if(length>.1){const step=Math.min(length,definition.speed*dt*(state.tick<unit.slowUntil?.55:1));unit.x+=dx/length*step;unit.y+=dy/length*step;unit.facing=Math.atan2(dy,dx);unit.travelled+=step;}
 for(const tower of state.towers){if(tower.hp<=0)continue;const min=tower.radius+definition.radius+1,d=distance(unit,tower);if(d<min){const angle=Math.atan2(unit.y-tower.y,unit.x-tower.x)||(unit.side==='player'?-Math.PI/2:Math.PI/2);unit.x=tower.x+Math.cos(angle)*min;unit.y=tower.y+Math.sin(angle)*min;}}
 if(!definition.flying&&unit.y>balance.riverTop&&unit.y<balance.riverBottom){const bridge=balance.bridges.reduce((best,x)=>Math.abs(x-unit.x)<Math.abs(best-unit.x)?x:best);unit.x=clamp(unit.x,bridge-balance.bridgeHalf+definition.radius/2,bridge+balance.bridgeHalf-definition.radius/2);}
 unit.x=clamp(unit.x,12,408);unit.y=clamp(unit.y,12,708);
}
function botDecision(state:Battle){
 if(state.tick<state.botNextAt)return;const novice=state.difficulty==='novice',professor=state.difficulty==='professor';state.botNextAt=state.tick+(novice?95:professor?28:50)+Math.round(random(state)*25);
 const threats=state.units.filter(u=>u.side==='player'&&u.y<420);const scores=[110,310].map(lane=>({lane,value:threats.filter(u=>Math.abs(u.x-lane)<120).reduce((s,u)=>s+(420-u.y)/200+(cards[u.card].damage/30)+(u.hp/500),0)})).sort((a,b)=>b.value-a.value);
 let lane=scores[0].value>0?scores[0].lane:(state.lastBotCard==='giant'||state.lastBotCard==='sentinel'?state.lastBotLane:random(state)<.5?110:310);const laneThreats=threats.filter(u=>Math.abs(u.x-lane)<120),air=laneThreats.some(u=>cards[u.card].flying),cluster=laneThreats.length>=3;
 const choices=state.botHand.filter(id=>cards[id].cost<=state.botEnergy);if(!choices.length)return;
 let choice:CardId;
 if(novice&&random(state)<.55){choice=choices[Math.floor(random(state)*choices.length)];lane=random(state)<.5?110:310;}
 else{const score=(id:CardId)=>{const c=cards[id];let n=0;if(c.building)n+=scores[0].value>0?5:-7;if(c.slow)n+=laneThreats.some(u=>cards[u.card].hp>700)?5:0;if(c.suicide)n+=cluster?5:-1;if(c.targets==='buildings'&&laneThreats.length)n-=4;if(scores[0].value>0){n+=id==='guardians'?5:0;n+=air&&c.targets==='all'?8:air?-8:0;n+=cluster&&(c.splash||0)>0?7:0;n+=id==='giant'?-8:0;if(isSpell(id)&&!cluster)n-=8;}else{n+=id==='giant'?6:0;n+=state.lastBotCard==='giant'&&c.range>75&&!c.building&&!isSpell(id)?8:0;n+=isSpell(id)?-6:0;if(state.tick>balance.matchSeconds*20*.8&&isSpell(id))n+=5;}if(professor){const weakest=state.towers.filter(t=>t.side==='player'&&t.hp>0).sort((a,b)=>a.hp-b.hp)[0];if(isSpell(id)&&weakest?.hp<=c.damage*.35)n+=40;n+=c.cost>state.botEnergy-1&&scores[0].value<4?-2:0;}return n+random(state)*(professor?.3:1.5);};choice=choices.map(id=>({id,score:score(id)})).sort((a,b)=>b.score-a.score||(a.id<b.id?-1:1))[0].id;}
 if(professor&&!laneThreats.length){const guards=state.towers.filter(t=>t.side==='player'&&t.kind==='guard'&&t.hp>0);if(guards.length)lane=guards.sort((a,b)=>a.hp-b.hp)[0].x;}let x=lane,y=laneThreats.length?Math.min(300,Math.max(160,Math.min(...laneThreats.map(u=>u.y))-65)):280;
 if(isSpell(choice)){const focus=laneThreats.length?laneThreats.reduce((a,b)=>a.hp>b.hp?a:b):state.towers.filter(t=>t.side==='player'&&t.hp>0).sort((a,b)=>a.hp-b.hp)[0];if(!focus)return;x=focus.x;y=focus.y;}
 if(!isSpell(choice)&&cards[choice].building){x=lane<210?155:265;y=235;}if(spendAndDeploy(state,'bot',choice,x,y)){state.lastBotLane=lane;state.lastBotCard=choice;}
}
function finish(state:Battle){
 const alive=(side:Side)=>state.towers.filter(t=>t.side===side&&t.hp>0),king=(side:Side)=>state.towers.find(t=>t.side===side&&t.kind==='king')!;
 if(king('bot').hp<=0&&king('player').hp<=0)state.result='draw';else if(king('bot').hp<=0)state.result='win';else if(king('player').hp<=0)state.result='loss';else if(state.tick>=balance.matchSeconds*1000/balance.tickMs){const crownDifference=alive('player').length-alive('bot').length;if(crownDifference)state.result=crownDifference>0?'win':'loss';else{const hp=(side:Side)=>alive(side).reduce((sum,t)=>sum+t.hp/t.maxHp,0),delta=hp('player')-hp('bot');state.result=Math.abs(delta)<.00001?'draw':delta>0?'win':'loss';}}
}
/** Exactly one fixed simulation step. RAF timing never enters game rules. */
export function stepBattle(state:Battle){
 if(state.result)return;state.tick++;const dt=balance.tickMs/1000;state.botEnergy=Math.min(balance.maxEnergy,state.botEnergy+balance.botEnergyPerSecond*dt);botDecision(state);
 for(const tower of state.towers){if(tower.hp<=0||state.tick<tower.attackAt)continue;const target=state.units.filter(u=>u.side!==tower.side&&u.hp>0&&distance(u,tower)<balance.tower.range+cards[u.card].radius).sort((a,b)=>distance(a,tower)-distance(b,tower))[0];if(target){projectile(state,tower,target,balance.tower.damage);tower.attackAt=state.tick+Math.round(balance.tower.cooldownSeconds*1000/balance.tickMs);}}
 for(const unit of state.units){if(unit.hp<=0)continue;const definition=cards[unit.card];if(definition.lifetime&&state.tick-unit.bornAt>=definition.lifetime*20){unit.hp=0;effect(state,unit.x,unit.y,'collapse',unit.side);continue;}const target=nearestTarget(state,unit);if(!target)continue;
  if(distance(unit,target)<=definition.range+('radius'in target?target.radius:cards[target.card].radius)){if(state.tick>=unit.attackAt){unit.facing=Math.atan2(target.y-unit.y,target.x-unit.x);unit.lastAttack=state.tick;
   const amount=definition.damage*levelScale(unit.level)*(unit.chargeReady&&unit.travelled>=40?(definition.charge||1):1);unit.chargeReady=false;
   if(definition.suicide){for(const victim of [...state.units,...state.towers])if(victim.side!==unit.side&&victim.hp>0&&distance(victim,target)<=(definition.splash||0)+('radius'in victim?victim.radius:cards[victim.card].radius))damage(state,victim,amount,unit.side);unit.hp=0;effect(state,unit.x,unit.y,'fire',unit.side);}else projectile(state,unit,target,amount,definition.splash);
   unit.attackAt=state.tick+Math.round(definition.cooldown*1000/balance.tickMs*(state.tick<unit.slowUntil?1.5:1));}}else move(state,unit,target,dt);
 }
 for(let i=0;i<state.units.length;i++)for(let j=i+1;j<state.units.length;j++){const a=state.units[i],b=state.units[j];if(a.hp<=0||b.hp<=0||Boolean(cards[a.card].flying)!==Boolean(cards[b.card].flying))continue;if(cards[a.card].building&&cards[b.card].building)continue;const d=distance(a,b),min=cards[a.card].radius+cards[b.card].radius;if(d<min){const dx=d<.01?(a.id<b.id?1:-1):(a.x-b.x)/d,dy=d<.01?0:(a.y-b.y)/d,push=Math.min(1.2,(min-d)*.3);if(!cards[a.card].building){a.x=clamp(a.x+dx*push,12,408);a.y=clamp(a.y+dy*push,12,708);}if(!cards[b.card].building){b.x=clamp(b.x-dx*push,12,408);b.y=clamp(b.y-dy*push,12,708);}}}
 for(const p of state.projectiles){const target=[...state.units,...state.towers].find(u=>u.id===p.targetId&&u.hp>0);if(target){p.toX=target.x;p.toY=target.y;}const progress=clamp((state.tick-p.start)/(p.end-p.start),0,1);p.x=p.fromX+(p.toX-p.fromX)*progress;p.y=p.fromY+(p.toY-p.fromY)*progress;
  if(state.tick>=p.end){if(p.splash){for(const t of [...state.units,...state.towers])if(t.side!==p.side&&t.hp>0&&distance(t,{x:p.toX,y:p.toY})<=p.splash+('radius'in t?t.radius:0)){damage(state,t,p.damage*('kind'in t||('card'in t&&cards[t.card].building)?p.buildingScale:1),p.side);if('card'in t&&p.slow)t.slowUntil=Math.max(t.slowUntil,state.tick+p.slow*20);}effect(state,p.toX,p.toY,'fire',p.side);}else if(target){damage(state,target,p.damage,p.side);if('card'in target&&p.slow)target.slowUntil=Math.max(target.slowUntil,state.tick+p.slow*20);}}
 }
 for(const u of state.units){const c=cards[u.card];for(const t of state.towers){const d=distance(u,t),minimum=t.radius+c.radius+1;if(t.hp>0&&d<minimum){const angle=Math.atan2(u.y-t.y,u.x-t.x);u.x=t.x+Math.cos(angle)*minimum;u.y=t.y+Math.sin(angle)*minimum;}}if(!c.flying&&u.y>balance.riverTop&&u.y<balance.riverBottom){u.x=clamp(u.x,u.lane-balance.bridgeHalf+c.radius/2,u.lane+balance.bridgeHalf-c.radius/2);}u.x=Math.round(u.x*1000)/1000;u.y=Math.round(u.y*1000)/1000;u.hp=Math.round(u.hp*1000)/1000;}for(const t of state.towers)t.hp=Math.round(t.hp*1000)/1000;
 state.projectiles=state.projectiles.filter(p=>p.end>state.tick);state.units=state.units.filter(u=>u.hp>0);state.effects=state.effects.filter(e=>state.tick-e.at<20).slice(-100);finish(state);
}
export function advanceBattle(state:Battle,tick:number){if(!Number.isInteger(tick)||tick<state.tick||tick>balance.matchSeconds*1000/balance.tickMs)throw Error('Некорректное время матча.');while(state.tick<tick&&!state.result)stepBattle(state);return state;}
export function replayBattle(seed:number,difficulty:Difficulty,deck:CardId[],levels:Battle['levels'],commands:GameCommand[],endTick:number){
 if(commands.length>balance.maxCommands)throw Error('Слишком много действий.');const state=createBattle(seed,difficulty,deck,levels);let last=0;
 for(const command of commands){if(!Number.isInteger(command.tick)||command.tick<last||command.tick>endTick)throw Error('Нарушен порядок действий.');advanceBattle(state,command.tick);if(!applyCommand(state,command))throw Error('Недопустимая карта, позиция или энергия.');last=command.tick;}return advanceBattle(state,endTick);
}
