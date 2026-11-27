import * as T from 'three';
import {GLTFLoader, type GLTF} from 'three/addons/loaders/GLTFLoader.js';
import {MeshoptDecoder} from 'three/addons/libs/meshopt_decoder.module.js';
import {clone} from 'three/addons/utils/SkeletonUtils.js';
import type {CardId,Side} from '../config';
import type {ModelPose} from './models';
import type {ArenaQuality} from './arena-model';
import {figureAsset} from './figure-assets';

const figures: Partial<Record<CardId, {height:number;forward?:number}>> = {
 knight:{height:1.92},archers:{height:1.73},giant:{height:2.73},skeletons:{height:1.47},
 dragon:{height:1.92},mage:{height:2.05},guardians:{height:1.83},
 spears:{height:1.28,forward:.83},sentinel:{height:2.27},
 rider:{height:2.48},frost:{height:2.14},ember:{height:1.65},
 ballista:{height:2.06},hunters:{height:1.75},
};

type FigureAssetId = CardId | 'hunters-silver';

function figureAssets(cards: readonly CardId[]): FigureAssetId[] {
 const assets: FigureAssetId[] = [...new Set(cards)];
 if (assets.includes('hunters')) assets.push('hunters-silver');
 return assets;
}

export function createFigureLibrary(onProgress?: (ready:number,total:number,failed:number)=>void, knightQuality:ArenaQuality='high') {
 const loader=new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
 const assets=new Map<string,GLTF>();
 const pendingKnights=new Map<ArenaQuality,Promise<void>>();
 const knightPaint=new Map<T.MeshStandardMaterial,T.MeshStandardMaterial>();
 const resources=new Set<T.BufferGeometry|T.Material|T.Texture>();
 const bound=new Set<ReturnType<typeof createInstance>>();
 const pending=new Map<FigureAssetId,Promise<void>>();
 const unavailable=new Set<FigureAssetId>();
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
 function knightKey(quality:ArenaQuality){return 'knight-'+quality;}
 function fetchKnight(quality:ArenaQuality){
  const key=knightKey(quality);
  if(disposed||assets.has(key))return Promise.resolve();
  const pending=pendingKnights.get(quality);
  if(pending)return pending;
  const request=loader.loadAsync(figureAsset('knight',quality)).then(source=>{
   track(source);
   if(disposed)clear();else assets.set(key,source);
  }).finally(()=>pendingKnights.delete(quality));
  pendingKnights.set(quality,request);
  return request;
 }
 function setKnightQuality(quality:ArenaQuality){
  if(quality===knightQuality)return;
  knightQuality=quality;
  if(started||quality==='low')void fetchKnight(quality).catch(()=>undefined);
 }
 if(knightQuality==='low')void fetchKnight('low').catch(()=>undefined);
 function load(id:FigureAssetId):Promise<void>{
  if(disposed||assets.has(id))return Promise.resolve();
  if(id==='knight')return fetchKnight(knightQuality);
  const existing=pending.get(id);
  if(existing)return existing;
  const request=loader.loadAsync(figureAsset(id)).then(source=>{
   track(source);
   if(disposed)clear();else assets.set(id,source);
  }).catch(error=>{unavailable.add(id);throw error;}).finally(()=>pending.delete(id));
  pending.set(id,request);
  return request;
 }
 function preload(cards:readonly CardId[]){
  if(started||disposed)return;
  const entries=figureAssets(cards);
  started=true;onProgress?.(0,entries.length,0);
  let index=0;
  async function next(){
   while(!disposed&&index<entries.length){
    const id=entries[index++];
    try{await load(id);}catch{failed++;}
    if(!disposed)onProgress?.(++settled,entries.length,failed);
   }
  }
  for(let i=0;i<4;i++)void next();
 }
 function prepare(cards:readonly CardId[]){
  if(disposed)return;
  for(const id of figureAssets(cards)){
   if(!unavailable.has(id))void load(id).catch(()=>undefined);
  }
 }
 const projectile=(id:'fireball'|'meteor')=>{
  const source=assets.get(id);if(!source)return;
  const model=clone(source.scene),root=new T.Group(),bounds=new T.Box3().setFromObject(model);
  model.position.copy(bounds.getCenter(new T.Vector3())).multiplyScalar(-1);
  root.rotation.y=Math.PI;
  root.add(model);root.scale.setScalar(id==='fireball'?.83:.92);
  return root;
 };
 function createInstance(source:GLTF,id:CardId,side?:Side) {
  const root=new T.Group();
  const model=clone(source.scene);
  const skeletons=new Set<T.Skeleton>();
  model.traverse(node=>{
   if(node instanceof T.SkinnedMesh)skeletons.add(node.skeleton);
   if(id!=='knight'||side!=='bot'||!(node instanceof T.Mesh))return;
   function swap(material:T.Material){
    if(!(material instanceof T.MeshStandardMaterial)||!material.name.startsWith('TEAM'))return material;
    let rendered=knightPaint.get(material);
    if(!rendered){
     rendered=material.clone();
     rendered.color.setHex(material.name.includes('Raised')?0xc45369:0x8c2944);
     resources.add(rendered);
     knightPaint.set(material,rendered);
    }
    return rendered;
   }
   node.material=Array.isArray(node.material)?node.material.map(swap):swap(node.material);
  });
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
  const instance={root,animate,dispose(){
   mixer.stopAllAction();
   mixer.uncacheRoot(model);
   root.removeFromParent();
   // Cloned rigs own their bone textures. Mesh geometries and materials are shared by the library.
   for(const skeleton of skeletons)skeleton.dispose();
   bound.delete(instance);
  }};
  return instance;
 }
 return {
  preload,prepare,projectile,setKnightQuality,
  knightTier(){
   return assets.has(knightKey(knightQuality))?knightQuality:
     (['medium','high','low'] as const).find(q=>assets.has(knightKey(q)));
  },
  create(id:CardId,silver=false,side?:Side,quality?:ArenaQuality){
   if(id==='hunters'&&silver&&!assets.has('hunters-silver')&&!unavailable.has('hunters-silver'))return;
   const source=id==='knight'&&quality?assets.get(knightKey(quality)):
     (id==='hunters'&&silver?assets.get('hunters-silver'):undefined)??assets.get(id);
   if(!source||disposed)return;
   const instance=createInstance(source,id,side);bound.add(instance);return instance;
  },
  dispose(){disposed=true;for(const item of bound)item.dispose();assets.clear();knightPaint.clear();clear();},
 };
}
