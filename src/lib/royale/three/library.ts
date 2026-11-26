import * as T from 'three';
import {GLTFLoader, type GLTF} from 'three/addons/loaders/GLTFLoader.js';
import {MeshoptDecoder} from 'three/addons/libs/meshopt_decoder.module.js';
import {clone} from 'three/addons/utils/SkeletonUtils.js';
import type {CardId} from '../config';
import type {ModelPose} from './models';

const figures: Partial<Record<CardId, {file?:string;height:number;forward?:number}>> = {
 knight:{height:1.92},archers:{height:1.73},giant:{height:2.73},skeletons:{height:1.47},
 dragon:{height:1.92},mage:{height:2.05},guardians:{height:1.83},
 spears:{file:'wind',height:1.28,forward:.83},sentinel:{height:2.27},
 rider:{height:2.48},frost:{height:2.14},ember:{height:1.65},
 ballista:{height:2.06},hunters:{height:1.75},
};

const premiumFigures=new Set(['giant','frost']);
const remasteredFigures=new Set(['rider','ember','ballista','meteor','hunters','hunters-silver']);

export function createFigureLibrary(onProgress?: (ready:number,total:number,failed:number)=>void, initialLow=false) {
 const loader=new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
 const assets=new Map<string,GLTF>();
 const resources=new Set<T.BufferGeometry|T.Material|T.Texture>();
 const bound=new Set<ReturnType<typeof createInstance>>();
 const entries=[...Object.entries(figures),['hunters-silver',figures.hunters!],['fireball',{height:1.2}],['meteor',{height:1.65}]] as Array<[string,{file?:string;height:number}]>;
 let disposed=false, settled=0, failed=0, started=false;
 const track=(data:GLTF)=>data.scene.traverse(o=>{
  if(!(o instanceof T.Mesh))return;
  resources.add(o.geometry);
  for(const m of [o.material].flat() as T.Material[]){
   resources.add(m);
   for(const value of Object.values(m))if(value instanceof T.Texture)resources.add(value);
  }
 });
 const clear=()=>{for(const value of resources)value.dispose();resources.clear();};
 function preload(){
  if(started||disposed)return;
  started=true;onProgress?.(0,entries.length,0);
  let index=0;
  async function next(){
   while(!disposed&&index<entries.length){
    const [id,spec]=entries[index++];
    try{
     const folder=premiumFigures.has(id)?'v3':remasteredFigures.has(id)?'remaster':'v1';
     const file=(spec.file??id)+'.glb';
     const source=await loader.loadAsync('/royale/'+folder+'/'+file);
     track(source);
     if(disposed)clear();else assets.set(id,source);
    }catch{failed++;}
    if(!disposed)onProgress?.(++settled,entries.length,failed);
   }
  }
  for(let i=0;i<4;i++)void next();
 }
 if(!initialLow)preload();
 const projectile=(id:'fireball'|'meteor')=>{
  const source=assets.get(id);if(!source)return;
  const model=clone(source.scene),root=new T.Group(),bounds=new T.Box3().setFromObject(model);
  model.position.copy(bounds.getCenter(new T.Vector3())).multiplyScalar(-1);
  root.rotation.y=Math.PI;
  root.add(model);root.scale.setScalar(id==='fireball'?.83:.92);
  return root;
 };
 function createInstance(source:GLTF,id:CardId) {
  const root=new T.Group();
  const model=clone(source.scene);
  const spec=figures[id]!;
  const bounds=new T.Box3().setFromObject(model);
  const height=bounds.max.y-bounds.min.y;
  const content=new T.Group();
  content.add(model);
  const scale=height>.01?spec.height/height:1;
  content.scale.setScalar(scale);content.position.y=-bounds.min.y*scale;
  if(spec.forward){
   content.rotation.x=spec.forward;
   content.position.y=spec.height*.75;
  }else content.rotation.y=Math.PI;
  root.add(content);
  const mixer=new T.AnimationMixer(model);
  const clips=new Map(source.animations.map(clip=>[clip.name.toLowerCase(),clip]));
  const clip=(name:string)=>clips.get(name.toLowerCase());
  for(const name of ['Attack','Hit','Defeat']){
   const single=clip(name);if(single){const play=mixer.clipAction(single);play.setLoop(T.LoopOnce,1);play.clampWhenFinished=true;}
  }
  const fallback=clip('Idle')??clips.values().next().value;
  let action:T.AnimationAction|undefined;
  let last:number|undefined;
  function animate(pose:ModelPose){
   if(id==='spears'){content.position.y=spec.height*.74+(pose.reducedMotion?0:.11*Math.sin(pose.time*5));return;}
   if(!fallback)return;
   const next=(pose.death>0?clip('Defeat'):pose.hit>.08?clip('Hit'):
    pose.attack>.04?clip('Attack'):pose.moving?(clip(id==='dragon'||id==='ember'?'Fly':'Walk')??clip('Run')):
    id==='dragon'?clip('Hover'):undefined)??fallback;
   const active=mixer.clipAction(next);
   const dt=last===undefined||pose.reducedMotion?0:Math.min(.1,Math.max(0,pose.time-last));
   if(active!==action){
    active.reset().setEffectiveWeight(1).play();
    if(action)active.crossFadeFrom(action,.13,false);
    action=active;
   }
   if(pose.death>0)active.time=Math.min(.999,pose.death)*next.duration;
   if(pose.reducedMotion)active.time=0;
   mixer.update(dt);last=pose.time;
  }
  const instance={root,animate,dispose(){mixer.stopAllAction();mixer.uncacheRoot(model);root.removeFromParent();bound.delete(instance);}};
  return instance;
 }
 return {
  preload,projectile,
  create(id:CardId,silver=false){
   const source=(id==='hunters'&&silver?assets.get('hunters-silver'):undefined)??assets.get(id);
   if(!source||disposed)return;
   const instance=createInstance(source,id);bound.add(instance);return instance;
  },
  dispose(){disposed=true;for(const item of bound)item.dispose();assets.clear();clear();},
 };
}
