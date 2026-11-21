import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import type {ModelRig} from './models';
/** Low quality bakes the original coloured silhouette into one shared mesh per identity. */
export class LowDetailCache{
 private geometry=new Map<string,T.BufferGeometry>();
 private material=new T.MeshStandardMaterial({vertexColors:true,roughness:.9,flatShading:true,side:T.DoubleSide});
 create(key:string,factory:()=>ModelRig){let geometry=this.geometry.get(key);if(!geometry){const rig=factory(),pieces:T.BufferGeometry[]=[];rig.root.updateMatrixWorld(true);rig.root.traverse(node=>{if(!(node instanceof T.Mesh)||!(node.material instanceof T.MeshStandardMaterial))return;let g=node.geometry.clone().applyMatrix4(node.matrixWorld);if(g.index){const expanded=g.toNonIndexed();g.dispose();g=expanded;}g.deleteAttribute('uv');const colors=new Float32Array(g.getAttribute('position').count*3),c=node.material.color;for(let i=0;i<colors.length;i+=3){colors[i]=c.r;colors[i+1]=c.g;colors[i+2]=c.b;}g.setAttribute('color',new T.BufferAttribute(colors,3));pieces.push(g);});const combined=mergeGeometries(pieces,false);pieces.forEach(g=>g.dispose());if(!combined)throw Error('Не удалось подготовить упрощённую модель.');geometry=combined;this.geometry.set(key,geometry);}
 return new T.Mesh(geometry,this.material);
 }
 get size(){return this.geometry.size;}
 dispose(){this.geometry.forEach(g=>g.dispose());this.geometry.clear();this.material.dispose();}
}
