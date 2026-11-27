import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import type {CardId,Side} from '../config';

export const teamColors:Record<Side,number>={player:0x76d9ff,bot:0xff8564};
type Accent = { color: number; motion: 'orbit' | 'dust' | 'wind' | 'spark' };
const accents: Record<CardId, Accent> = {
 knight:{color:0xffd779,motion:'orbit'}, archers:{color:0x89d88d,motion:'wind'},
 giant:{color:0xcbb090,motion:'dust'}, skeletons:{color:0xadcfff,motion:'spark'},
 dragon:{color:0x62deff,motion:'wind'}, mage:{color:0xc4a6ff,motion:'spark'},
 fireball:{color:0xffaa38,motion:'spark'}, guardians:{color:0xf7ae51,motion:'orbit'},
 spears:{color:0xb0f3e1,motion:'wind'}, sentinel:{color:0xbc91f0,motion:'spark'},
 rider:{color:0xffc052,motion:'wind'}, frost:{color:0xa4e9ff,motion:'orbit'},
 ember:{color:0xffa13e,motion:'spark'}, ballista:{color:0xcac5b5,motion:'dust'},
 meteor:{color:0xd18aff,motion:'orbit'}, hunters:{color:0xbc9aec,motion:'wind'},
};

type EffectQuality = 'low' | 'medium' | 'high' | 'ultra';
const limits = {
 low:{particles:0,rings:12,arrivals:0,aura:0},
 medium:{particles:60,rings:20,arrivals:3,aura:2},
 high:{particles:108,rings:26,arrivals:6,aura:4},
 ultra:{particles:150,rings:32,arrivals:9,aura:6},
};
const fade = (t:number) => Math.sin(Math.PI*t)**.78;

type Burst={x:number;z:number;start:number;radius:number;color:number};
export function expansionEffects(scene:T.Scene) {
 const p=new T.IcosahedronGeometry(.09,0),ring=new T.RingGeometry(.93,1,40);
 const pm=new T.MeshBasicMaterial({toneMapped:false,transparent:true,opacity:.66,depthWrite:false,blending:T.AdditiveBlending});
 const rm=new T.MeshBasicMaterial({transparent:true,opacity:.74,depthWrite:false,toneMapped:false,side:T.DoubleSide,blending:T.AdditiveBlending});
 const motes=new T.InstancedMesh(p,pm,limits.ultra.particles);
 const shockwaves=new T.InstancedMesh(ring,rm,limits.ultra.rings);
 const loops=Array.from({length:3},(_,i)=>new T.RingGeometry(.94,1,24).scale(.77,.30,1).rotateZ(i*Math.PI/3));
 const atom=mergeGeometries(loops);
 loops.forEach(loop=>loop.dispose());
 const runes=new T.InstancedMesh(atom,rm,12);
 const temp=new T.Object3D(),rgb=new T.Color();
 const bursts:Burst[]=[];
 for(const batch of [motes,shockwaves,runes]){
  batch.frustumCulled=false;
  batch.instanceMatrix.setUsage(T.DynamicDrawUsage);
  batch.count=0;
  scene.add(batch);
 }
 let particles=0,rings=0,symbols=0,current=0,enabled=false;
 let budget=limits.high;
 function seal(batch:T.InstancedMesh,index:number,x:number,z:number,y:number,radius:number,hex:number,brightness:number){
  temp.position.set(x,y,z);
  temp.rotation.set(-Math.PI/2,0,0);
  temp.scale.setScalar(radius);
  temp.updateMatrix();
  batch.setMatrixAt(index,temp.matrix);
  batch.setColorAt(index,color(hex,brightness));
 }
 function color(hex:number,brightness=1){return rgb.setHex(hex).multiplyScalar(brightness);}
 function dot(x:number,y:number,z:number,scale:number,hex:number,tilt:number,glow=1){
  if(particles>=budget.particles||scale<=0)return;
  temp.position.set(x,y,z);
  temp.scale.set(scale,scale*.64,scale*1.55);
  temp.rotation.set(tilt,tilt*.71,0);temp.updateMatrix();
  motes.setMatrixAt(particles,temp.matrix);motes.setColorAt(particles++,color(hex,glow));
 }
 return {
  begin(seconds:number,quality:EffectQuality,reduced:boolean){
   current=seconds;budget=limits[quality];enabled=!reduced;particles=rings=symbols=0;
  },
  badge(x:number,y:number,z:number,side:Side,id:number){
   if(!enabled||rings>=budget.rings)return;
   seal(shockwaves,rings++,x,z,y,.38,teamColors[side],.54+Math.sin(id)*.08);
  },
  arrival(card:CardId,x:number,z:number,side:Side,id:number,age:number){
   if(!enabled||age<0||age>=.72||rings>=budget.rings)return;
   const t=age/.72,{color:hex,motion}=accents[card],glow=fade(t);
   const radius=.40+.93*(1-(1-t)**2);
   seal(shockwaves,rings++,x,z,.26,radius,teamColors[side],.62*glow);
   if(budget.aura>0&&symbols<runes.instanceMatrix.count){
    seal(runes,symbols++,x,z,.28,radius*.85,hex,.82*glow);
   }
   for(let i=0;i<budget.arrivals;i++){
    const angle=i*2.4+id*.41+(motion==='wind'?2.1:.7)*t;
    const lift=motion==='dust'?.27:motion==='spark'?.79:.53;
    dot(x+radius*Math.cos(angle),.28+Math.sin(Math.PI*t)*lift,
     z+radius*Math.sin(angle),.68*glow,hex,angle,glow);
   }
  },
  aura(card:CardId,id:number,x:number,y:number,z:number,attack:number){
   if(!enabled||attack<=.1||budget.aura===0)return;
   const {color:hex,motion}=accents[card];
   for(let i=0;i<budget.aura;i++){
    const t=(current*(motion==='spark'?3.7:2.2)+i*.19+id*.31)%1;
    const r=.26+(motion==='wind'?1.24:.76)*t,a=i*2.4+current*2;
    const height=motion==='dust'?.20:motion==='spark'?1.15:.64;
    const glow=fade(t)*attack;
    dot(x+Math.cos(a)*r,y+.26+t*height,z+Math.sin(a)*r,.62*glow,hex,a,glow);
   }
  },
  comet(card:'fireball'|'meteor',x:number,y:number,z:number,dx:number,dz:number){
   if(!enabled)return;
   const isMeteor=card==='meteor',count=budget.arrivals*2;
   for(let i=0;i<count;i++){
    const t=(i/count+current*.43)%1,a=t*11+current*8,step=t*3.2;
    dot(x-dx*step+Math.cos(a)*.60*t,y+Math.sin(a)*.68*t+t*.63,z-dz*step+Math.sin(a*.85)*.58*t,.65*(1-t)+.1,isMeteor?(i%3===0?0x79dfff:i%2===0?0x8c64ff:0xe983e4):i%3===0?0xffdeb0:0xff8b29,a,1.35);
   }
  },
  burst(card:CardId,x:number,z:number,radius:number){
   if(!enabled||bursts.length>=12)return;
   bursts.push({x,z,radius,start:current,color:accents[card].color});
  },
  finish(){
   for(let b=bursts.length-1;b>=0;b--){
    const {x,z,start,radius,color:hex}=bursts[b];const elapsed=current-start,t=elapsed/.62;
    if(t>=1){bursts.splice(b,1);continue;}
    if(!enabled)continue;
    if(rings<budget.rings){
     const radial=radius*(1-Math.exp(-5*(t+.035)));
     temp.position.set(x,.34,z);temp.rotation.set(-Math.PI/2,0,0);temp.scale.setScalar(radial);temp.updateMatrix();
     shockwaves.setMatrixAt(rings,temp.matrix);shockwaves.setColorAt(rings++,color(hex,1.4*(1-t)));
    }
    for(let i=0;i<budget.arrivals*2;i++){
     const a=i*2.399,dist=radius*t*(.54+.36*Math.cos(i*3));
     dot(x+Math.cos(a)*dist,.24+Math.sin(t*Math.PI)*(1.9+Math.cos(i)*.88),z+Math.sin(a)*dist,(1-t)*.95,hex,a+t,1.4);
    }
   }
   motes.count=particles;shockwaves.count=rings;runes.count=symbols;
   for(const batch of [motes,shockwaves,runes]){
    if(!batch.count)continue;
    batch.instanceMatrix.needsUpdate=true;
    if(batch.instanceColor)batch.instanceColor.needsUpdate=true;
   }
  },
  dispose(){
   scene.remove(motes,shockwaves,runes);
   [p,ring,atom,pm,rm,motes,shockwaves,runes].forEach(item=>item.dispose());
  },
 };
}
