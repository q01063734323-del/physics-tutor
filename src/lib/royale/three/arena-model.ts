import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {MeshoptDecoder} from 'three/addons/libs/meshopt_decoder.module.js';
import type {Tower} from '../engine';

export function loadSkyArena(scene:T.Scene,onSettled:(ok:boolean)=>void) {
 const solids=new Set<T.BufferGeometry|T.Material|T.Texture>();
 let disposed=false,started=false,root:T.Group|undefined,mixer:T.AnimationMixer|undefined;
 const flowing=new Map<T.Texture,{u:number;v:number}>();
 let quality='low',lastTime=-1;
 const towers=new Map<string,T.Object3D>();
 const towerCasters=new Set<T.Mesh>();
 const groups=['04 Blue keep','04 Red keep','05 Blue left turret','05 Blue right turret','05 Red left turret','05 Red right turret'];
 const groupNodes=new Map<string,T.Object3D>();
 const towerNodes=new Set<T.Object3D>();
 function cleanup(){solids.forEach(item=>item.dispose());solids.clear();}
 return {
  preload(){
   if(disposed||started)return;
   started=true;
   void new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).loadAsync('/royale/remaster/sky-arena.glb').then(gltf=>{
    gltf.scene.traverse(node=>{
     for(const name of groups){
      if(node.name===name||node.name===name.replaceAll(' ','_')||node.name===name.replaceAll(' ','')){
       groupNodes.set(name,node);towerNodes.add(node);
      }
     }
     if(!(node instanceof T.Mesh))return;
     solids.add(node.geometry);
     node.receiveShadow=true;
     let ancestor:T.Object3D|null=node.parent;
     while(ancestor&&!towerNodes.has(ancestor))ancestor=ancestor.parent;
     if(ancestor&&node.geometry.getAttribute('position').count>100){
      towerCasters.add(node);
      node.castShadow=quality==='high';
     }
     for(const material of [node.material].flat() as T.MeshStandardMaterial[]){
      if(solids.has(material))continue;
      solids.add(material);
      for(const value of Object.values(material))if(value instanceof T.Texture)solids.add(value);
      const isFall=material.name.includes('Waterfall');
      const isChannel=material.name.includes('Aether channel');
      if(isFall||isChannel){
       const textures=new Map<T.Texture,T.Texture>();
       const role=isFall?['map','emissiveMap','normalMap'] as const:['normalMap'] as const;
       for(const field of role){
        const original=material[field];if(!original)continue;
        let texture=textures.get(original);
        if(!texture){texture=original.clone();texture.wrapS=texture.wrapT=T.RepeatWrapping;
         texture.needsUpdate=true;solids.add(texture);textures.set(original,texture);
         flowing.set(texture,isFall?{u:.008,v:-.12}:{u:.034,v:-.063});
        }
        material[field]=texture;
       }
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
  setQuality(next:string){
   quality=next;
   if(root)root.visible=next!=='low';
   for(const node of towerCasters)node.castShadow=next==='high';
  },
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
   for(const [texture,{u,v}] of flowing)texture.offset.set((time*u)%1,(time*v)%1);
  },
  dispose(){disposed=true;mixer?.stopAllAction();if(root){mixer?.uncacheRoot(root);root.removeFromParent();}cleanup();flowing.clear();towers.clear();towerNodes.clear();towerCasters.clear();groupNodes.clear();},
 };
}
