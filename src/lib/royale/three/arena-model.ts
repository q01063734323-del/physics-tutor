import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {MeshoptDecoder} from 'three/addons/libs/meshopt_decoder.module.js';
import type {Tower} from '../engine';
import {createWaterfallAlpha} from './waterfall-alpha';

export type ArenaQuality='high'|'medium'|'low';

const anchors=['04 Blue keep','04 Red keep','05 Blue left turret','05 Blue right turret','05 Red left turret','05 Red right turret'];
const lookupNames=new Map(anchors.map(name=>[T.PropertyBinding.sanitizeNodeName(name),name]));

type LoadedArena={
 root:T.Group;
 mixer:T.AnimationMixer;
 towers:Map<string,T.Object3D>;
 flowing:Map<T.Texture,{u:number;v:number}>;
 resources:Set<T.BufferGeometry|T.Material|T.Texture>;
};

export function loadSkyArena(scene:T.Scene,onSettled:(ok:boolean)=>void,initial:ArenaQuality) {
 const loader=new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
 const pending=new Set<ArenaQuality>();
 const cache=new Map<ArenaQuality,LoadedArena>();
 let disposed=false,requested=initial,active:LoadedArena|undefined,lastTime=-1,shadowsDirty=true;
 let notified=false;

 function release(arena:LoadedArena){
  arena.mixer.stopAllAction();
  arena.mixer.uncacheRoot(arena.root);
  arena.root.removeFromParent();
  for(const item of arena.resources)item.dispose();
 }
 function report(ok:boolean){if(!notified){notified=true;onSettled(ok);}}
 function setActive(arena:LoadedArena){
  if(active===arena)return;
  active?.root.removeFromParent();
  active=arena;
  scene.add(arena.root);
  lastTime=-1;
  shadowsDirty=true;
 }
 async function loadQuality(next:ArenaQuality){
  requested=next;
  const ready=cache.get(next);
  if(ready){setActive(ready);report(true);return;}
  if(disposed||pending.has(next))return;
  pending.add(next);
  try{
   const gltf=await loader.loadAsync('/royale/sky6/sky-arena-'+next+'.glb');
   const model:LoadedArena={root:gltf.scene,mixer:new T.AnimationMixer(gltf.scene),towers:new Map(),resources:new Set(),flowing:new Map()};
   const roots=new Set<T.Object3D>();
   let alpha:T.Texture|undefined;
   gltf.scene.traverse(node=>{
    const anchor=lookupNames.get(node.name);
    if(anchor){model.towers.set(anchor,node);roots.add(node);}
    if(!(node instanceof T.Mesh))return;
    model.resources.add(node.geometry);
    let p:T.Object3D|null=node.parent;
    while(p&&!roots.has(p))p=p.parent;
    const mats=[node.material].flat() as T.MeshStandardMaterial[];
    const translucent=mats.some(m=>m.name.startsWith('Cloud banks')||m.name.startsWith('Waterfall'));
    node.receiveShadow=!translucent;
    node.castShadow=Boolean(p)&&next!=='low'&&!translucent;
    if(translucent)node.renderOrder=mats.some(m=>m.name.startsWith('Cloud banks'))?2:3;
    for(const mat of mats){
     if(model.resources.has(mat))continue;
     model.resources.add(mat);
     for(const value of Object.values(mat))if(value instanceof T.Texture)model.resources.add(value);
     const isFall=mat.name.startsWith('Waterfall');
     const isCanal=mat.name.startsWith('Canal');
     if(isFall){
      if(!alpha){alpha=createWaterfallAlpha();model.resources.add(alpha);}
      mat.alphaMap=alpha;
      mat.transparent=true;
      mat.depthWrite=false;
      mat.opacity=.91;
      mat.emissive.setHex(0x439bc8);
      mat.emissiveIntensity=.34;
      mat.side=T.DoubleSide;
     }
     if(mat.name.startsWith('Cloud banks')){
      mat.depthWrite=false;
      mat.transparent=true;
     }
     if(isFall||isCanal){
      for(const field of ['map','normalMap'] as const){
       const original=mat[field];if(!original)continue;
       const map=original.clone();
       map.wrapS=map.wrapT=T.RepeatWrapping;
       map.needsUpdate=true;
       mat[field]=map;model.resources.add(map);
       model.flowing.set(map,isFall?{u:.005,v:-.188}:{u:.091,v:-.040});
      }
     }
    }
   });
   if(disposed){release(model);return;}
   if(model.towers.size!==anchors.length){release(model);if(requested===next)report(false);return;}
   for(const clip of gltf.animations)model.mixer.clipAction(clip).play();
   cache.set(next,model);
   if(requested===next||!active){setActive(model);report(true);}
  }catch{
   if(!disposed&&requested===next)report(false);
  }finally{pending.delete(next);}
 }
 return {
  setQuality(next:ArenaQuality){if(next!==requested||!active)void loadQuality(next);},
  active(){return Boolean(active);},
  consumeShadowChange(){const dirty=shadowsDirty;shadowsDirty=false;return dirty;},
  setTower(t:Tower){
   const team=t.side==='player'?'Blue':'Red';
   const key=t.kind==='king'?'04 '+team+' keep':'05 '+team+(t.x<210?' left':' right')+' turret';
   const tower=active?.towers.get(key);
   if(tower&&tower.visible!==(t.hp>0)){tower.visible=t.hp>0;shadowsDirty=true;}
  },
  update(seconds:number,reduced:boolean){
   if(!active)return;
   const hz=requested==='low'?10:requested==='medium'?18:30;
   const time=reduced?0:Math.floor(seconds*hz)/hz;
   if(time===lastTime)return;
   lastTime=time;active.mixer.setTime(time);
   for(const [texture,{u,v}] of active.flowing)texture.offset.set((u*time)%1,(v*time)%1);
  },
  dispose(){disposed=true;for(const model of cache.values())release(model);cache.clear();active=undefined;},
 };
}
