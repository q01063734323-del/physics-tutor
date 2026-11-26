import * as T from 'three';
import type {CardId,Side} from '../config';

export const teamColors:Record<Side,number>={player:0x76d9ff,bot:0xff8564};
const accents:Partial<Record<CardId,number>>={
 frost:0x7ae8ff,rider:0xffc052,ember:0xffa13e,meteor:0xd18aff,hunters:0xec85ff,ballista:0x55dfff,spears:0x7ff4ee,fireball:0xffaa38,
};

type Burst={x:number;z:number;start:number;radius:number;color:number};
export function expansionEffects(scene:T.Scene) {
 const p=new T.IcosahedronGeometry(.09,0),ring=new T.RingGeometry(.93,1,40);
 const pm=new T.MeshBasicMaterial({toneMapped:false});
 const rm=new T.MeshBasicMaterial({transparent:true,opacity:.74,depthWrite:false,toneMapped:false,side:T.DoubleSide,blending:T.AdditiveBlending});
 const motes=new T.InstancedMesh(p,pm,120),shockwaves=new T.InstancedMesh(ring,rm,18);
 const temp=new T.Object3D(),rgb=new T.Color();
 const bursts:Burst[]=[];
 motes.frustumCulled=shockwaves.frustumCulled=false;
 motes.count=shockwaves.count=0;scene.add(motes,shockwaves);
 let particles=0,rings=0,current=0,enabled=false;
 function color(hex:number,brightness=1){return rgb.setHex(hex).multiplyScalar(brightness);}
 function dot(x:number,y:number,z:number,scale:number,hex:number,tilt:number,glow=1){
  if(particles>=120||scale<=0)return;
  temp.position.set(x,y,z);
  temp.scale.set(scale,scale*.64,scale*1.55);
  temp.rotation.set(tilt,tilt*.71,0);temp.updateMatrix();
  motes.setMatrixAt(particles,temp.matrix);motes.setColorAt(particles++,color(hex,glow));
 }
 return {
  begin(seconds:number,run:boolean){current=seconds;enabled=run;particles=rings=0;},
  badge(x:number,y:number,z:number,side:Side,id:number){
   temp.position.set(x,y,z);temp.rotation.set(-Math.PI/2,0,0);temp.scale.setScalar(.39);temp.updateMatrix();
   if(rings>=18)return;
   shockwaves.setMatrixAt(rings,temp.matrix);
   shockwaves.setColorAt(rings++,color(teamColors[side],.87+Math.sin(id)*.13));
  },
  arrival(x:number,z:number,side:Side,id:number,age:number,high:boolean){
   if(!enabled||age<0||age>=.57)return;
   const t=age/.57,hex=teamColors[side],radius=.28+.57*(1-(1-t)**2);
   if(rings<18){
    temp.position.set(x,.25,z);temp.rotation.set(-Math.PI/2,0,0);temp.scale.setScalar(radius);temp.updateMatrix();
    shockwaves.setMatrixAt(rings,temp.matrix);
    shockwaves.setColorAt(rings++,color(hex,1.28*(1-t)));
    if(high&&rings<18&&t<.68){
     temp.position.y=.28;temp.scale.setScalar(radius*.63);
     temp.updateMatrix();shockwaves.setMatrixAt(rings,temp.matrix);
     shockwaves.setColorAt(rings++,color(side==='player'?0xe4c4ff:0xffca93,.9*(1-t)));
    }
   }
   for(let i=0;i<(high?7:3);i++){
    const angle=i*2.4+id*.41+t*.7;
    dot(x+radius*Math.cos(angle),.27+Math.sin(Math.PI*t)*(.3+(i%3)*.14),
        z+radius*Math.sin(angle),.61*(1-t),hex,angle,1.4);
   }
  },
  aura(card:CardId,id:number,x:number,y:number,z:number,attack:number,high:boolean){
   const hex=accents[card];
   if(!enabled||hex===undefined)return;
   const count=card==='ember'?5:attack>.12?(high?6:3):0;
   for(let i=0;i<count;i++){
    const t=(current*2.7+i*.173+id*.31)%1,r=.25+.74*t,a=i*2.4+current*2;
    dot(x+Math.cos(a)*r,y+.34+t*.91,z+Math.sin(a)*r,.45*(1-t)+.1,hex,a,1.10);
   }
  },
  comet(card:'fireball'|'meteor',x:number,y:number,z:number,dx:number,dz:number,high:boolean){
   if(!enabled)return;
   const isMeteor=card==='meteor',count=high?16:8;
   for(let i=0;i<count;i++){
    const t=(i/count+current*.43)%1,a=t*11+current*8,step=t*3.2;
    dot(x-dx*step+Math.cos(a)*.60*t,y+Math.sin(a)*.68*t+t*.63,z-dz*step+Math.sin(a*.85)*.58*t,.65*(1-t)+.1,isMeteor?(i%3===0?0x79dfff:i%2===0?0x8c64ff:0xe983e4):i%3===0?0xffdeb0:0xff8b29,a,1.35);
   }
  },
  burst(card:CardId,x:number,z:number,radius:number){
   if(!enabled||bursts.length>=12)return;
   bursts.push({x,z,radius,start:current,color:accents[card]??0xffb45b});
  },
  finish(high:boolean){
   for(let b=bursts.length-1;b>=0;b--){
    const {x,z,start,radius,color:hex}=bursts[b];const elapsed=current-start,t=elapsed/.62;
    if(t>=1){bursts.splice(b,1);continue;}
    if(!enabled)continue;
    if(rings<18){
     const radial=radius*(1-Math.exp(-5*(t+.035)));
     temp.position.set(x,.34,z);temp.rotation.set(-Math.PI/2,0,0);temp.scale.setScalar(radial);temp.updateMatrix();
     shockwaves.setMatrixAt(rings,temp.matrix);shockwaves.setColorAt(rings++,color(hex,1.4*(1-t)));
    }
    for(let i=0;i<(high?18:9);i++){
     const a=i*2.399,dist=radius*t*(.54+.36*Math.cos(i*3));
     dot(x+Math.cos(a)*dist,.24+Math.sin(t*Math.PI)*(1.9+Math.cos(i)*.88),z+Math.sin(a)*dist,(1-t)*.95,hex,a+t,1.4);
    }
   }
   motes.count=particles;shockwaves.count=rings;
   motes.instanceMatrix.needsUpdate=shockwaves.instanceMatrix.needsUpdate=true;
   if(motes.instanceColor)motes.instanceColor.needsUpdate=true;
   if(shockwaves.instanceColor)shockwaves.instanceColor.needsUpdate=true;
  },
  dispose(){scene.remove(motes,shockwaves);[p,ring,pm,rm,motes,shockwaves].forEach(item=>item.dispose());},
 };
}
