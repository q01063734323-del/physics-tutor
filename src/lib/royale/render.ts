import {cards,balance,isSpell,arenas,type CardId} from './config';
import type {Battle} from './engine';
export type Art=Map<string,HTMLImageElement>;
export function loadArt(onLoad:()=>void){
 const art:Art=new Map(),images:HTMLImageElement[]=[],failed:string[]=[];
 for(const key of ['arena','tower','castle',...arenas.map(a=>'arena-'+a.id),...Object.keys(cards).map(id=>'unit-'+id)]){const img=new Image();img.onload=onLoad;img.onerror=()=>{failed.push(key);onLoad();};img.src=`/royale/${key}.svg`;art.set(key,img);images.push(img);}
 return {art,failed,dispose(){for(const img of images){img.onload=null;img.onerror=null;}}};
}
function sprite(ctx:CanvasRenderingContext2D,art:Art,key:string,x:number,y:number,width:number,height:number){const image=art.get(key);if(image?.complete&&image.naturalWidth){ctx.drawImage(image,x,y,width,height);return true;}return false;}
function bar(ctx:CanvasRenderingContext2D,x:number,y:number,width:number,fraction:number,color:string){ctx.fillStyle='#101e30dd';ctx.fillRect(x-width/2,y,width,5);ctx.fillStyle=color;ctx.fillRect(x-width/2,y,width*Math.max(0,fraction),5);}
export function renderBattle(ctx:CanvasRenderingContext2D,state:Battle,art:Art,selected:CardId|null,alpha:number,previous:Map<number,{x:number;y:number}>,reducedMotion=false,cursor?:{x:number;y:number},theme='academy',lowQuality=false){
 const w=balance.width,h=balance.height,time=state.tick+alpha;
 ctx.setTransform(ctx.canvas.width/w,0,0,ctx.canvas.height/h,0,0);ctx.clearRect(0,0,w,h);
 if(!sprite(ctx,art,'arena-'+theme,0,0,w,h))sprite(ctx,art,'arena',0,0,w,h);
 // Water ripples stay between bridges and never obscure placement or troop silhouettes.
 if(!reducedMotion&&!lowQuality){ctx.save();ctx.strokeStyle=theme==='heat'?'#ffd19255':'#cdf8ff44';ctx.lineWidth=1;for(let i=0;i<9;i++){const x=(i*51+time*.45)%420;if(balance.bridges.some(b=>Math.abs(x-b)<32))continue;ctx.beginPath();ctx.moveTo(x,351+(i%3)*8);ctx.quadraticCurveTo(x+9,348+(i%3)*8,x+20,351+(i%3)*8);ctx.stroke();}ctx.restore();}
 ctx.fillStyle='#f7a27708';ctx.fillRect(18,18,384,320);ctx.fillStyle='#8ed9f008';ctx.fillRect(18,382,384,320);
 if(selected){const spell=isSpell(selected);ctx.fillStyle=spell?'#f3bf6728':'#8ee7c51d';ctx.fillRect(12,spell?12:394,396,spell?696:314);ctx.strokeStyle='#f7dd96aa';ctx.lineWidth=2;ctx.setLineDash([6,6]);ctx.strokeRect(12,spell?12:394,396,spell?696:314);ctx.setLineDash([]);}
 for(const tower of state.towers){
  if(tower.hp<=0){ctx.fillStyle='#37352c';ctx.beginPath();ctx.ellipse(tower.x,tower.y+8,28,14,0,0,Math.PI*2);ctx.fill();ctx.fillStyle='#a3987c';for(let i=0;i<5;i++)ctx.fillRect(tower.x-22+i*10,tower.y+(i%2)*8,7,6);continue;}
  const king=tower.kind==='king',width=king?68:56,height=king?82:70,critical=tower.hp/tower.maxHp<.25;
  ctx.save();if(state.tick-tower.hitAt<3&&!lowQuality)ctx.filter='brightness(1.6)';
  ctx.fillStyle=tower.side==='player'?'#6bd3f655':'#f39a6d55';ctx.beginPath();ctx.ellipse(tower.x,tower.y+15,width/2,18,0,0,Math.PI*2);ctx.fill();
  sprite(ctx,art,king?'castle':'tower',tower.x-width/2,tower.y-height+23,width,height);ctx.restore();
  if(critical){ctx.save();ctx.globalAlpha=reducedMotion?.8:.5+.3*Math.sin(time*.13);ctx.strokeStyle='#ff956d';ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(tower.x,tower.y+12,width/2+3,20,0,0,Math.PI*2);ctx.stroke();ctx.restore();}
  bar(ctx,tower.x,tower.y-height+15,king?55:43,tower.hp/tower.maxHp,critical?'#ff9a71':tower.side==='player'?'#76d8f0':'#ff9a82');ctx.fillStyle='#fffcdf';ctx.font='bold 10px system-ui';ctx.textAlign='center';ctx.fillText(String(Math.ceil(tower.hp)),tower.x,tower.y-height+11);
 }
 for(const unit of [...state.units].sort((a,b)=>a.y-b.y||a.id-b.id)){
  const c=cards[unit.card],old=previous.get(unit.id)||unit,x=old.x+(unit.x-old.x)*alpha,y=old.y+(unit.y-old.y)*alpha;
  const moving=Math.abs(old.x-unit.x)+Math.abs(old.y-unit.y)>.02,bob=reducedMotion||c.building?0:Math.sin(time*(moving?.35:.09)+unit.id)*(moving?1.9:.6);
  const size=c.radius*2.9+10,flying=c.flying?12:0,attack=Math.max(0,1-(time-unit.lastAttack)/7),spawn=Math.min(1,(time-unit.bornAt)/8);
  ctx.fillStyle='#10202e60';ctx.beginPath();ctx.ellipse(x,y+5,c.radius+3,c.radius*.5,0,0,Math.PI*2);ctx.fill();ctx.strokeStyle=unit.side==='player'?'#8be5ff':'#ffae85';ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(x,y+3,c.radius+4,c.radius*.55,0,0,Math.PI*2);ctx.stroke();
  ctx.save();ctx.translate(x+(reducedMotion?0:Math.cos(unit.facing)*attack*5),y+bob-flying);if(!reducedMotion){ctx.scale(.8+.2*spawn,.8+.2*spawn);ctx.rotate((moving?.025*Math.sin(time*.35):0)+Math.cos(unit.facing)*attack*.09);}if(Math.cos(unit.facing)<-.15)ctx.scale(-1,1);
  if(!lowQuality){if(state.tick<unit.slowUntil)ctx.filter='sepia(.4) hue-rotate(150deg)';else if(state.tick-unit.hitAt<3)ctx.filter='brightness(1.9)';}
  sprite(ctx,art,'unit-'+unit.card,-size/2,-size,size,size);ctx.restore();
  if(state.tick<unit.slowUntil){ctx.strokeStyle='#c3f7ff';ctx.lineWidth=1;ctx.beginPath();ctx.arc(x,y-c.radius,Math.max(6,c.radius-2),0,Math.PI*2);ctx.stroke();}
  bar(ctx,x,y-size-2-flying,size*.7,unit.hp/unit.maxHp,unit.side==='player'?'#9aee9b':'#ffc189');
 }
 for(const p of state.projectiles){const t=Math.max(0,Math.min(1,(time-p.start)/(p.end-p.start))),lift=p.kind==='comet'?Math.sin(t*Math.PI)*90:p.kind==='arrow'?Math.sin(t*Math.PI)*15:0;ctx.save();ctx.translate(p.x,p.y-lift);
  if(p.kind==='arrow'){ctx.rotate(Math.atan2(p.toY-p.fromY,p.toX-p.fromX));ctx.strokeStyle='#f6e5b0';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(-8,0);ctx.lineTo(3,0);ctx.moveTo(0,-3);ctx.lineTo(4,0);ctx.lineTo(0,3);ctx.stroke();}
  else{const ice=p.kind==='ice',radius=p.kind==='comet'?12:5;ctx.fillStyle=ice?'#b9f6ff':'#ffc66d';ctx.beginPath();ctx.arc(0,0,radius,0,Math.PI*2);ctx.fill();if(!lowQuality){ctx.globalAlpha=.25;ctx.beginPath();ctx.arc(0,0,radius*1.8,0,Math.PI*2);ctx.fill();}ctx.fillStyle='#fff6ce';ctx.fillRect(-2,-2,3,3);}ctx.restore();
 }
 // Particles are procedural from the bounded engine effect list: no per-frame particle objects.
 for(const e of state.effects){const t=(time-e.at)/20;if(t<0||t>1)continue;ctx.save();ctx.globalAlpha=1-t;
  if(e.card&&e.kind==='collapse'){const size=cards[e.card].radius*2.9+10;ctx.translate(e.x,e.y);ctx.rotate(reducedMotion?0:t*.45);sprite(ctx,art,'unit-'+e.card,-size/2,-size+t*12,size,size);ctx.translate(-e.x,-e.y);}
  ctx.strokeStyle=e.kind==='fire'?'#ffdc82':e.side==='player'?'#c6f7ff':'#ffe0ba';ctx.lineWidth=e.kind==='collapse'?4:2;ctx.beginPath();ctx.arc(e.x,e.y,(e.kind==='fire'?60:e.kind==='collapse'?32:18)*t+3,0,Math.PI*2);ctx.stroke();
  if(!reducedMotion&&!lowQuality){const count=e.kind==='fire'?12:e.kind==='collapse'?9:4;for(let i=0;i<count;i++){const angle=i*2.399+e.id*.7,r=(e.kind==='fire'?68:30)*t;ctx.fillStyle=e.kind==='fire'?(i%2?'#ffad6e':'#ffdf9d'):e.kind==='collapse'?'#d2c49e':'#d4f4ed';ctx.fillRect(e.x+Math.cos(angle)*r,e.y+Math.sin(angle)*r-12*Math.sin(t*Math.PI),i%2?3:4,i%2?3:4);}}
  ctx.restore();
 }
 if(cursor&&selected){ctx.strokeStyle='#fff5b9';ctx.lineWidth=2;ctx.beginPath();ctx.arc(cursor.x,cursor.y,isSpell(selected)?cards[selected].radius:cards[selected].radius+5,0,Math.PI*2);ctx.stroke();}
}
