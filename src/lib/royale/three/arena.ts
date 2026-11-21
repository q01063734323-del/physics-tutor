import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {arenaWorld,gameToWorld} from './coordinates';
export type ArenaArt={root:T.Group;water:T.Mesh;lights:T.DirectionalLight[];setQuality:(q:'low'|'medium'|'high')=>void;animate:(time:number,reduced:boolean)=>void;dispose:()=>void};
const palettes:Record<string,{grass:number;soil:number;water:number;stone:number;accent:number}>={academy:{grass:0x74ae73,soil:0x556a53,water:0x48b4cf,stone:0xd8c8a0,accent:0xe7c87c},mechanics:{grass:0x8fa783,soil:0x69746c,water:0x7eb8ce,stone:0xb6bcc0,accent:0xd5d9b0},heat:{grass:0xa78558,soil:0x755647,water:0xe48a48,stone:0xc4a481,accent:0xffce83},electricity:{grass:0x728aa4,soil:0x53657c,water:0x8d9ee3,stone:0xc0c9cf,accent:0xc5b2f6},masters:{grass:0x859c88,soil:0x5c6677,water:0x77c7c3,stone:0xcdc5c0,accent:0xf0cd84}};
export function createArena(theme:string):ArenaArt{
 const p=palettes[theme]||palettes.academy,root=new T.Group(),geometry:T.BufferGeometry[]=[],materials:T.Material[]=[];
 const geo=<G extends T.BufferGeometry>(g:G)=>{geometry.push(g);return g;};
 const mat=(color:number,extra:Partial<T.MeshStandardMaterialParameters>={})=>{const m=new T.MeshStandardMaterial({color,roughness:.85,flatShading:true,...extra});materials.push(m);return m;};
 const ground=mat(p.grass),soil=mat(p.soil),stone=mat(p.stone),trim=mat(p.accent),path=mat(0xc9bd94),leaves=mat(0x447d61),trunk=mat(0x756246);
 const box=geo(new T.BoxGeometry(1,1,1)),cone=geo(new T.ConeGeometry(.7,1.5,7)),cylinder=geo(new T.CylinderGeometry(.13,.18,1,6)),rock=geo(new T.DodecahedronGeometry(.35,0));
 const add=(g:T.BufferGeometry,m:T.Material,x:number,y:number,z:number,sx=1,sy=1,sz=1)=>{const mesh=new T.Mesh(g,m);mesh.position.set(x,y,z);mesh.scale.set(sx,sy,sz);mesh.castShadow=true;mesh.receiveShadow=true;root.add(mesh);return mesh;};
 add(box,soil,0,-.82,0,22.4,1.35,37.4);add(box,stone,0,-.21,0,22.1,.2,37.1);
 for(const side of [-1,1]){add(box,ground,0,-.01,side*9.4,21,.32,17.2);for(const x of arenaWorld.bridgeCenters){add(box,path,x,.165,side*9.65,2.35,.05,16.2);for(let j=0;j<12;j++)add(box,stone,x,.196,side*(2+j*1.25),2.12,.015,.045);}}
 const waterMaterial=mat(p.water,{roughness:.3,metalness:.1,transparent:true,opacity:.9});const water=add(box,waterMaterial,0,-.01,0,21,.12,arenaWorld.riverWidth);
 for(const x of arenaWorld.bridgeCenters){add(box,stone,x,.21,0,arenaWorld.bridgeWidth,.44,2.5);for(let i=-3;i<=3;i++)add(box,path,x,.455,i*.34,arenaWorld.bridgeWidth-.12,.08,.28);for(const side of [-1,1]){add(box,stone,x+side*(arenaWorld.bridgeWidth/2-.07),.65,0,.16,.5,2.6);for(const z of [-1.18,1.18]){add(box,trim,x+side*(arenaWorld.bridgeWidth/2-.07),.98,z,.22,.2,.22);}}}
 for(const x of [-10.95,10.95])add(box,stone,x,.27,0,.28,.65,36.5);
 for(const z of [-18.25,18.25])add(box,stone,0,.27,z,22,.65,.28);
 // Original repeated scenery uses instancing; decorations stay outside paths and tower radii.
 const grassGeometry=geo(new T.ConeGeometry(.11,.36,3)),grassInstances=new T.InstancedMesh(grassGeometry,leaves,90),dummy=new T.Object3D();
 for(let i=0;i<90;i++){const side=i%2?-1:1,x=side*(8.9+(i%7)*.13),z=-16+(i*5.173%32);dummy.position.set(x,.3,z);dummy.rotation.y=i*.83;dummy.scale.setScalar(.7+(i%4)*.17);dummy.updateMatrix();grassInstances.setMatrixAt(i,dummy.matrix);}grassInstances.castShadow=false;root.add(grassInstances);
 for(let i=0;i<16;i++){const x=(i%2?-1:1)*9.3,z=-15.5+Math.floor(i/2)*4.4;if(Math.abs(z)<2)continue;add(cylinder,trunk,x,.6,z,1,1,1);add(cone,leaves,x,1.48,z,1,1,1);add(cone,leaves,x,1.96,z,.72,.7,.72);}
 for(let i=0;i<12;i++)add(rock,stone,(i%2?-1:1)*8.3,.3,-16+(i*7.1%32),1+i%3*.2,.7,1);
 const ripples=new T.Group(),rippleMaterial=new T.MeshBasicMaterial({color:0xe1f6ef,transparent:true,opacity:.22,depthWrite:false});materials.push(rippleMaterial);const rippleGeo=geo(new T.PlaneGeometry(.6,.035));for(let i=0;i<18;i++){const ripple=new T.Mesh(rippleGeo,rippleMaterial);ripple.rotation.x=-Math.PI/2;ripple.position.set(-9+i*1.05,.065,(i%3-.9)*.4);ripples.add(ripple);}root.add(ripples);
 // Bake static scenery by material: bridges, roads and trees need only a few draw calls.
 const batches=new Map<T.Material,T.Mesh[]>();for(const child of [...root.children])if(child instanceof T.Mesh&&!(child instanceof T.InstancedMesh)&&child!==water){const material=child.material as T.Material,list=batches.get(material)||[];list.push(child);batches.set(material,list);}
 for(const [material,meshes]of batches){if(meshes.length<2)continue;const parts=meshes.map(mesh=>{mesh.updateMatrix();let g=mesh.geometry.clone().applyMatrix4(mesh.matrix);if(g.index){const flat=g.toNonIndexed();g.dispose();g=flat;}return g;});const merged=mergeGeometries(parts,false);parts.forEach(g=>g.dispose());if(!merged)continue;geometry.push(merged);meshes.forEach(m=>root.remove(m));const mesh=new T.Mesh(merged,material);mesh.castShadow=true;mesh.receiveShadow=true;root.add(mesh);}
 const lights:T.DirectionalLight[]=[];
 return{root,water,lights,setQuality(q){grassInstances.visible=q!=='low';ripples.visible=q!=='low';},animate(time,reduced){if(reduced)return;water.position.y=-.01+Math.sin(time*.025)*.014;for(let i=0;i<ripples.children.length;i++){const r=ripples.children[i];r.position.x=-10+((i*1.1+time*.015)%20);r.visible=!arenaWorld.bridgeCenters.some(x=>Math.abs(x-r.position.x)<1.25);}},dispose(){geometry.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());root.clear();}};
}
export const towerWorldPositions=()=>['player','bot'].flatMap(side=>[...['guard','guard','king']].map((kind,i)=>({...gameToWorld(i===2?210:i===0?110:310,side==='player'?(i===2?658:594):(i===2?62:126)),side,kind})));
