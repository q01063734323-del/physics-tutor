import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {MeshoptDecoder} from 'three/addons/libs/meshopt_decoder.module.js';
import type {Tower} from '../engine';

export function loadSkyArena(scene:T.Scene,onSettled:(ok:boolean)=>void) {
 const solids=new Set<T.BufferGeometry|T.Material|T.Texture>();
 let disposed=false,started=false,root:T.Group|undefined,mixer:T.AnimationMixer|undefined;
 let animatedWater:T.Texture|undefined,quality='low',lastTime=-1;
 const towers=new Map<string,T.Object3D>();
 const groups=['04 Blue keep','04 Red keep','05 Blue left turret','05 Blue right turret','05 Red left turret','05 Red right turret'];
 const groupNodes=new Map<string,T.Object3D>();
 function cleanup(){solids.forEach(item=>item.dispose());solids.clear();}
 return {
  preload(){
   if(disposed||started)return;
   started=true;
   void new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).loadAsync('/royale/v1/sky-arena.glb').then(gltf=>{
    gltf.scene.traverse(node=>{
     for(const name of groups)if(node.name===name.replaceAll(' ','')||node.name===name||node.name===name.replaceAll(' ','_'))groupNodes.set(name,node);
     if(!(node instanceof T.Mesh))return;
     solids.add(node.geometry);
     node.receiveShadow=true;
     for(const material of [node.material].flat() as T.MeshStandardMaterial[]){
      solids.add(material);
      for(const value of Object.values(material))if(value instanceof T.Texture)solids.add(value);
      if(material.name.includes('Aether channel')&&material.normalMap){
       animatedWater=material.normalMap.clone();animatedWater.wrapS=animatedWater.wrapT=T.RepeatWrapping;
       material.normalMap=animatedWater;solids.add(animatedWater);
      }
     }
    });
    if(disposed){cleanup();return;}
    if(groupNodes.size!==groups.length){cleanup();onSettled(false);return;}
    root=gltf.scene;root.visible=quality!=='low';scene.add(root);
    for(const [name,node] of groupNodes)towers.set(name,node);
    mixer=new T.AnimationMixer(root);
    gltf.animations.forEach(clip=>mixer!.clipAction(clip).play());
    onSettled(true);
   }).catch(()=>{if(!disposed)onSettled(false);});
  },
  setQuality(next:string){quality=next;if(root)root.visible=next!=='low';},
  active(){return Boolean(root?.visible);},
  setTower(t:Tower){const name=t.side==='player'?'Blue':'Red';
   const tower=towers.get(t.kind==='king'?'04 '+name+' keep':'05 '+name+(t.x<210?' left':' right')+' turret');
   if(tower)tower.visible=t.hp>0;
  },
  update(seconds:number,reduced:boolean){
   if(!root?.visible)return;
   const time=reduced?0:Math.floor(seconds*(quality==='high'?30:15))/(quality==='high'?30:15);
   if(time===lastTime)return;
   lastTime=time;mixer?.setTime(time);
   animatedWater?.offset.set(time*.024,-time*.087);
  },
  dispose(){disposed=true;mixer?.stopAllAction();if(root){mixer?.uncacheRoot(root);root.removeFromParent();}cleanup();towers.clear();},
 };
}
