import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {cards,isSpell,type CardId,type Side} from '../config';
import {canPlace,type Unit,type Tower} from '../engine';
import type {BattleView,GroundPoint,ViewFrame} from '../presentation';
import {gameToWorld,worldToGame,WORLD_SCALE} from './coordinates';
import {createBattleCamera,fitBattleCamera} from './camera';
import {createArena} from './arena';
import {createSkyBloom} from './sky-bloom';
import {createSkyMotes} from './sky-motes';
import {watchContextLoss} from './context';
import {LowDetailCache} from './lod';
import {createFigureLibrary} from './library';
import {loadSkyArena,type ArenaQuality} from './arena-model';
import {expansionEffects} from './expansion-effects';
import {ModelWorkshop,type ModelRig} from './models';

type Health={group:T.Group;fill:T.Mesh};
type Figure={rig:ModelRig;art?:NonNullable<ReturnType<ReturnType<typeof createFigureLibrary>['create']>>;health:Health;unit:Unit;deadAt:number|null};
type Turret={rig:ModelRig;health:Health;tower:Tower;rubble:T.Group};
const scaleOf=(id:CardId)=>id==='dragon'?1:1.22;
const heightOf=(id:CardId)=>id==='giant'?3.58:id==='rider'?3.24:id==='dragon'?2.24:id==='ballista'?2.72:id==='frost'||id==='sentinel'?2.95:2.48;
/** The only source of combat truth is ViewFrame.battle. No timers advance game rules here. */
export function create3DView(canvas:HTMLCanvasElement,theme:string,onFailure:(message:string)=>void,onProgress?:(ready:number,total:number)=>void,initialQuality:ArenaQuality='high'):BattleView{
 let renderer:T.WebGLRenderer;
 try{renderer=new T.WebGLRenderer({canvas,antialias:true,alpha:true,powerPreference:'default'});}catch{throw Error('На этом устройстве недоступен WebGL 2. Продолжим в классическом режиме.');}
 const startLow=initialQuality==='low';
 const scene=new T.Scene();
 scene.fog=new T.Fog(0x7e91ba,46,106);
 renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.04;
 renderer.shadowMap.type=T.PCFShadowMap;
 renderer.shadowMap.autoUpdate=false;
 renderer.info.autoReset=false;
 const camera=createBattleCamera(),world=createArena(theme),workshop=new ModelWorkshop();scene.add(world.root);
 scene.add(new T.HemisphereLight(0xb3c9ff,0x6b597b,1.33));
 const sun=new T.DirectionalLight(0xffd5a2,3.1);sun.position.set(-14,29,9);sun.shadow.camera.left=-25;sun.shadow.camera.right=25;sun.shadow.camera.top=28;sun.shadow.camera.bottom=-28;sun.shadow.camera.near=1;sun.shadow.camera.far=80;sun.shadow.bias=-.001;sun.shadow.normalBias=.045;sun.shadow.radius=2.7;scene.add(sun);scene.add(sun.target);
 const motes=createSkyMotes(scene);
 let bloom:ReturnType<typeof createSkyBloom>|undefined;
 const geometry:T.BufferGeometry[]=[],materials:T.Material[]=[];
 const geo=<G extends T.BufferGeometry>(g:G)=>{geometry.push(g);return g;};
 const material=(color:number,transparent=false)=>{const m=new T.MeshBasicMaterial({color,transparent,opacity:transparent?.28:1,depthWrite:!transparent});materials.push(m);return m;};
 const barGeo=geo(new T.PlaneGeometry(1,.095)),barBack=material(0x243848),playerBar=material(0x63cfff),botBar=material(0xff876e),shadowGeo=geo(new T.CircleGeometry(.46,14)),shadowMaterial=material(0x182938,true),rubbleGeo=geo(new T.BoxGeometry(.3,.25,.28)),rubbleMat=new T.MeshStandardMaterial({color:0xaaa78a,roughness:1});materials.push(rubbleMat);
 let subscribed=0,totalAssets=0,failedAssets=0,arenaDone=false,arenaFailed=false,cometDone=false,cometFailed=false,loading=false;
 let comet:Awaited<ReturnType<typeof import('./approved-comet.mjs')['createCometFlame']>>|undefined;
 const comets=new Map<number,number>();
 const publishProgress=()=>{
  if(!loading||!totalAssets)return;
  onProgress?.(subscribed+Number(arenaDone)+Number(cometDone),totalAssets+2);
  if(arenaDone&&cometDone&&subscribed===totalAssets&&(failedAssets||arenaFailed||cometFailed))onFailure('Часть 3D-ресурсов не загрузилась. Для них используются облегчённые модели.');
 };
 const library=createFigureLibrary((ready,total,failed)=>{subscribed=ready;totalAssets=total;failedAssets=failed;publishProgress();},true);
 const effects=expansionEffects(scene);
 const sky=loadSkyArena(scene,ok=>{arenaDone=true;arenaFailed=!ok;publishProgress();},initialQuality);
 function preload(){
  if(loading)return;
  loading=true;library.preload();
  void import('./approved-comet.mjs').then(module=>module.createCometFlame(scene,{
   baseURL:new URL('/royale/v1/',location.href),quality:'medium',capacity:3,
  })).then(instance=>{if(disposed)instance.dispose();else comet=instance;})
   .catch(()=>{cometFailed=true;}).finally(()=>{cometDone=true;if(!disposed)publishProgress();});
 }
 const lod=new LowDetailCache(),lowMeshes=new WeakMap<T.Group,T.Mesh>();
 const figures=new Map<number,Figure>(),turrets=new Map<number,Turret>(),free=new Map<string,Figure[]>();let freeCount=0,disposed=false,lastQuality='',width=1,height=1,dpr=1;
 const health=(side:Side,w=1)=>{const group=new T.Group(),back=new T.Mesh(barGeo,barBack),fill=new T.Mesh(barGeo,side==='player'?playerBar:botBar);fill.position.z=.003;group.add(back,fill);group.scale.x=w;group.quaternion.copy(camera.quaternion);scene.add(group);return{group,fill};};
 function setHealth(h:Health,x:number,y:number,z:number,fraction:number){h.group.position.set(x,y,z);h.fill.scale.x=Math.max(0,fraction);h.fill.position.x=-(1-fraction)/2;}
 const contact=(rig:ModelRig,scale=1)=>{const disk=new T.Mesh(shadowGeo,shadowMaterial);disk.rotation.x=-Math.PI/2;disk.position.y=.025;disk.scale.setScalar(scale);disk.userData.contact=true;rig.root.add(disk);};
 function acquire(unit:Unit):Figure{const key=unit.card+unit.side+(unit.card==='hunters'?unit.id%2:''),cached=free.get(key)?.pop();if(cached){freeCount--;cached.unit=unit;cached.deadAt=null;cached.rig.root.visible=true;cached.health.group.visible=true;scene.add(cached.rig.root,cached.health.group);return cached;}const rig=workshop.createUnit(unit.card,unit.side);rig.root.traverse(node=>{if(node instanceof T.Mesh)node.castShadow=false;});contact(rig,cards[unit.card].radius/13);scene.add(rig.root);return{rig,unit,health:health(unit.side,.8),deadAt:null};}
 function release(id:number,entry:Figure){scene.remove(entry.rig.root,entry.health.group);figures.delete(id);if(freeCount<32){const key=entry.unit.card+entry.unit.side+(entry.unit.card==='hunters'?entry.unit.id%2:''),bucket=free.get(key)||[];bucket.push(entry);free.set(key,bucket);freeCount++;}else{entry.art?.dispose();}}
 const pointer=new T.Vector2(),ray=new T.Raycaster(),ground=new T.Plane(new T.Vector3(0,1,0),0),intersection=new T.Vector3();
 const zoneMaterial=material(0x9ee2af,true),zone=new T.Mesh(geo(new T.PlaneGeometry(19.2,15.4)),zoneMaterial);zone.rotation.x=-Math.PI/2;zone.position.set(0,.23,9.4);zone.visible=false;scene.add(zone);
 const markerMaterial=material(0xd3f7bd),marker=new T.Mesh(geo(new T.RingGeometry(.5,.57,32)),markerMaterial);marker.rotation.x=-Math.PI/2;marker.position.y=.28;marker.visible=false;scene.add(marker);
 let ghost:ModelRig|null=null,ghostCard:CardId|null=null;const ghostMaterials:T.Material[]=[];
 function clearGhost(){if(ghost)scene.remove(ghost.root);ghostMaterials.splice(0).forEach(m=>m.dispose());ghost=null;ghostCard=null;}
 const projectileGeo=geo(new T.IcosahedronGeometry(.16,0)),arrowGeo=geo(new T.CylinderGeometry(.025,.025,.65,5)),headGeo=geo(new T.ConeGeometry(.085,.18,5)),hot=material(0xffb955),cold=material(0xa8f5ff),arrowMat=material(0xffedba);
 const projectiles=new Map<number,T.Group>(),projectilePool:T.Group[]=[];
 function projectileGroup(){const group=projectilePool.pop()||new T.Group();if(!group.children.length){const orb=new T.Mesh(projectileGeo,hot),shaft=new T.Mesh(arrowGeo,arrowMat),tip=new T.Mesh(headGeo,arrowMat);shaft.rotation.x=Math.PI/2;tip.rotation.x=Math.PI/2;tip.position.z=.4;group.add(orb,shaft,tip);}scene.add(group);return group;}
 const particleMat=new T.MeshBasicMaterial({vertexColors:true}),particles=new T.InstancedMesh(geo(new T.IcosahedronGeometry(.075,0)),particleMat,160);materials.push(particleMat);particles.frustumCulled=false;particles.count=0;scene.add(particles);const dummy=new T.Object3D(),color=new T.Color(),aim=new T.Vector3();
 const crystalRoot=new T.Group();scene.add(crystalRoot);const mixers:T.AnimationMixer[]=[];const importedGeos=new Set<T.BufferGeometry>(),importedMats=new Set<T.Material>();
 const disposeImported=(root:T.Object3D)=>root.traverse(node=>{if(node instanceof T.Mesh){node.geometry.dispose();for(const m of Array.isArray(node.material)?node.material:[node.material])m.dispose();}});
 new GLTFLoader().load('/royale/3d/citadel-crystal.glb',gltf=>{if(disposed){disposeImported(gltf.scene);return;}gltf.scene.traverse(node=>{if(node instanceof T.Mesh){importedGeos.add(node.geometry);for(const m of Array.isArray(node.material)?node.material:[node.material])importedMats.add(m);}});for(const [x,z] of [[-8,-16],[8,16]]){const model=gltf.scene.clone(true);model.position.set(x,.17,z);crystalRoot.add(model);const mixer=new T.AnimationMixer(model);gltf.animations.forEach(clip=>mixer.clipAction(clip).play());mixers.push(mixer);}},undefined,()=>{if(!disposed)onFailure('Декоративная GLB-модель не загрузилась; бой доступен.');});
 const stopWatchingContext=watchContextLoss(canvas,()=>{if(!disposed)onFailure('WebGL-контекст потерян. Продолжаем этот бой в 2D.');});
 function quality(mode:ArenaQuality){if(lastQuality===mode)return;lastQuality=mode;const high=mode==='high';renderer.shadowMap.enabled=mode!=='low';sun.castShadow=mode!=='low';sun.shadow.mapSize.set(high?1024:512,high?1024:512);sun.shadow.map?.dispose();sun.shadow.map=null;renderer.shadowMap.needsUpdate=true;renderer.setPixelRatio(Math.min(dpr,mode==='low'?1:high?2:1.5));renderer.setSize(width,height,false);if(high&&renderer.extensions.has('EXT_color_buffer_float')){bloom??=createSkyBloom(renderer,scene,camera);bloom.resize(width,height,dpr);}world.setQuality(mode as 'low'|'medium'|'high');sky.setQuality(mode);if(mode!=='low')preload();}
 if(!startLow)preload();
 function present(entry:Figure,pose:Parameters<ModelRig['animate']>[0],low:boolean){
  const {rig,unit}=entry;
  rig.animate(pose);
  if(!entry.art&&!low){
   entry.art=library.create(unit.card,unit.id%2===0);
   if(entry.art)rig.root.add(entry.art.root);
  }
  const active=!!entry.art&&!low;
  detail(rig,low,'unit:'+unit.card+unit.side,()=>workshop.createUnit(unit.card,unit.side));
  if(entry.art){entry.art.root.visible=active;if(active){rig.body.visible=false;entry.art.animate(pose);}}
 }
 function detail(rig:ModelRig,low:boolean,key:string,factory:()=>ModelRig){rig.body.visible=!low;let mesh=lowMeshes.get(rig.root);if(low&&!mesh){mesh=lod.create(key,factory);lowMeshes.set(rig.root,mesh);rig.root.add(mesh);}if(mesh)mesh.visible=low;}
 return{
 resize(w,h,pixelRatio){width=Math.max(1,w);height=Math.max(1,h);dpr=pixelRatio;renderer.setPixelRatio(Math.min(dpr,lastQuality==='low'?1:lastQuality==='medium'?1.5:2));renderer.setSize(width,height,false);bloom?.resize(width,height,dpr);fitBattleCamera(camera,width/height);},
 pick(x,y,rect):GroundPoint|null{if(disposed||!rect.width||!rect.height)return null;pointer.set((x-rect.left)/rect.width*2-1,-(y-rect.top)/rect.height*2+1);ray.setFromCamera(pointer,camera);if(!ray.ray.intersectPlane(ground,intersection))return null;const result=worldToGame(intersection.x,intersection.z);return result.x>=0&&result.x<=420&&result.y>=0&&result.y<=720?result:null;},
 render(f:ViewFrame){if(disposed||renderer.getContext().isContextLost())return;const state=f.battle,time=state.tick+f.alpha,seconds=time/20,resolved=f.lowQuality||f.quality==='low'?'low':f.quality==='medium'?'medium':'high';quality(resolved);effects.begin(seconds,resolved!=='low'&&!f.reducedMotion);sky.update(seconds,f.reducedMotion);world.root.visible=!sky.active();crystalRoot.visible=!sky.active()&&resolved!=='low';if(world.root.visible)world.animate(time,f.reducedMotion);mixers.forEach(m=>m.setTime(f.reducedMotion?0:seconds));
  for(const t of state.towers){let entry=turrets.get(t.id);if(!entry){const rig=workshop.createTower(t.kind,t.side);contact(rig,t.kind==='king'?2.2:1.8);scene.add(rig.root);const rubble=new T.Group();for(let i=0;i<9;i++){const block=new T.Mesh(rubbleGeo,rubbleMat);block.position.set(Math.cos(i*2.4)*(.3+i*.06),.25,Math.sin(i*2.4)*(.3+i*.06));block.rotation.set(i*.2,i*.8,i*.4);rubble.add(block);}rubble.visible=false;scene.add(rubble);entry={rig,health:health(t.side,t.kind==='king'?1.6:1.25),tower:t,rubble};turrets.set(t.id,entry);}const p=gameToWorld(t.x,t.y),death=t.hp<=0?Math.min(1,(time-t.hitAt)/16):0;entry.rig.root.position.set(p.x,.18,p.z);entry.rig.root.rotation.y=t.side==='player'?0:Math.PI;sky.setTower(t);entry.rig.animate({time:seconds,moving:false,attack:t.attackAt>0?Math.max(0,1-(time-(t.attackAt-20))/6):0,hit:Math.max(0,1-(time-t.hitAt)/5),death,reducedMotion:f.reducedMotion});detail(entry.rig,f.lowQuality,'tower:'+t.kind+t.side,()=>workshop.createTower(t.kind,t.side));entry.rig.root.visible=death<1&&!sky.active();entry.health.group.visible=t.hp>0;setHealth(entry.health,p.x,t.kind==='king'?(sky.active()?4.96:3.95):3.07,p.z,t.hp/t.maxHp);entry.rubble.position.set(p.x,.1,p.z);entry.rubble.visible=death>0;}
  const currentIds=new Set<number>();for(const u of state.units){currentIds.add(u.id);let entry=figures.get(u.id);if(!entry){entry=acquire(u);figures.set(u.id,entry);}entry.unit=u;const old=f.previous.get(u.id)||u,x=old.x+(u.x-old.x)*f.alpha,y=old.y+(u.y-old.y)*f.alpha,p=gameToWorld(x,y),flying=cards[u.card].flying?.7:0;entry.rig.root.position.set(p.x,.18+flying,p.z);entry.rig.root.rotation.y=-u.facing-Math.PI/2;present(entry,{time:seconds,moving:Math.abs(old.x-u.x)+Math.abs(old.y-u.y)>.015,attack:Math.max(0,1-(time-u.lastAttack)/8),hit:Math.max(0,1-(time-u.hitAt)/5),death:0,reducedMotion:f.reducedMotion},f.lowQuality);entry.rig.root.scale.multiplyScalar(scaleOf(u.card)*Math.min(1,.4+(time-u.bornAt)/8));setHealth(entry.health,p.x,heightOf(u.card)+flying,p.z,u.hp/u.maxHp);
   if(resolved!=='low'){effects.arrival(p.x,p.z,u.side,u.id,(time-u.bornAt)/20,resolved==='high');effects.badge(p.x,.25,p.z,u.side,u.id);effects.aura(u.card,u.id,p.x,.2+flying,p.z,Math.max(0,1-(time-u.lastAttack)/8),resolved==='high');}}
  for(const [id,entry] of figures){if(currentIds.has(id))continue;if(entry.deadAt===null){
    entry.deadAt=time;
    if(entry.unit.card==='ember'&&time-entry.unit.lastAttack<3){const location=gameToWorld(entry.unit.x,entry.unit.y);effects.burst('ember',location.x,location.z,cards.ember.splash!*WORLD_SCALE);}
   }const death=(time-entry.deadAt)/12;entry.health.group.visible=false;if(death>=1)release(id,entry);else{present(entry,{time:seconds,moving:false,attack:0,hit:0,death,reducedMotion:f.reducedMotion},f.lowQuality);entry.rig.root.scale.setScalar(scaleOf(entry.unit.card)*(entry.art&&!f.lowQuality?1:Math.max(.1,1-death*.7)));}}
  const projectileIds=new Set<number>();for(const p of state.projectiles){projectileIds.add(p.id);let group=projectiles.get(p.id);if(!group){group=projectileGroup();projectiles.set(p.id,group);}const pos=gameToWorld(p.x,p.y),progress=Math.max(0,Math.min(1,(time-p.start)/(p.end-p.start))),tower=state.towers.find(t=>Math.hypot(t.x-p.fromX,t.y-p.fromY)<2),startHeight=tower?(tower.kind==='king'?3.1:2.3):1.1,height=startHeight*(1-progress)+.8*progress+Math.sin(progress*Math.PI)*(p.kind==='comet'?5:p.kind==='arrow'?.45:.2);group.position.set(pos.x,height,pos.z);const target=gameToWorld(p.toX,p.toY);aim.set(target.x,.8,target.z);group.lookAt(aim);group.visible=true;group.children[0].visible=p.kind!=='arrow';group.children[1].visible=group.children[2].visible=p.kind==='arrow';const orb=group.children[0] as T.Mesh;orb.material=p.kind==='ice'?cold:hot;orb.scale.setScalar(p.kind==='comet'?2.2:1);
   if(p.kind==='comet'&&resolved!=='low'){
    const card=p.end-p.start===24?'meteor':'fireball';
    if(card==='fireball'&&comet&&!f.reducedMotion){
     if(!comets.has(p.id)){
      const from=gameToWorld(p.fromX,p.fromY),to=gameToWorld(p.toX,p.toY);
      if(comet.spawn({from:new T.Vector3(from.x,1.1,from.z),to:new T.Vector3(to.x,.27,to.z),
       start:p.start/20,flight:(p.end-p.start)/20,lead:0,radius:p.splash*WORLD_SCALE,size:.58,height:5})){
       comets.set(p.id,p.end/20+.82);
      }
     }
     if(comets.has(p.id)){group.visible=false;continue;}
    }
    group.userData.burst={card,x:target.x,z:target.z,radius:p.splash*WORLD_SCALE,end:p.end};
    aim.set(target.x-pos.x,0,target.z-pos.z).normalize();
    effects.comet(card,pos.x,height,pos.z,aim.x,aim.z,resolved==='high');
    let skin:T.Object3D|undefined=group.children[3];
    if(!skin){skin=library.projectile(p.end-p.start===24?'meteor':'fireball');if(skin)group.add(skin);}
    if(skin){skin.visible=true;skin.rotation.z=f.reducedMotion?0:progress*2.6;orb.visible=false;}
   }else if(group.children[3])group.children[3].visible=false;
  }
  for(const [id,group] of projectiles)if(!projectileIds.has(id)){
   const landing=group.userData.burst;if(landing&&time>=landing.end&&time<landing.end+3)effects.burst(landing.card,landing.x,landing.z,landing.radius);
   delete group.userData.burst;scene.remove(group);group.children[3]?.removeFromParent();projectiles.delete(id);if(projectilePool.length<60)projectilePool.push(group);}
  let count=0;for(const e of state.effects){const age=(time-e.at)/20;if(age<0||age>1)continue;const origin=gameToWorld(e.x,e.y),amount=f.lowQuality?2:e.kind==='fire'?10:5;for(let i=0;i<amount&&count<160;i++){const angle=i*2.399+e.id,distance=age*(e.kind==='fire'?2.5:.9);dummy.position.set(origin.x+Math.cos(angle)*distance,.3+Math.sin(age*Math.PI)*(e.kind==='collapse'?1.3:.8),origin.z+Math.sin(angle)*distance);dummy.rotation.set(age*4,i,age*3);dummy.scale.setScalar((1-age)*(e.kind==='fire'?1.8:1));dummy.updateMatrix();particles.setMatrixAt(count,dummy.matrix);color.setHex(e.kind==='collapse'?0xc6b18e:e.kind==='fire'?0xffbe6c:e.side==='player'?0xa9f4e0:0xffc3a1);particles.setColorAt(count,color);count++;}}particles.count=count;if(count){particles.instanceMatrix.needsUpdate=true;if(particles.instanceColor)particles.instanceColor.needsUpdate=true;}
  zone.visible=Boolean(f.selected);if(f.selected){const spell=isSpell(f.selected);zone.position.z=spell?0:9.4;zone.scale.y=spell?34.2/15.4:1;const valid=f.cursor&&canPlace(state,f.selected,f.cursor.x,f.cursor.y);zoneMaterial.color.setHex(spell?0xf2d188:0x95dba9);markerMaterial.color.setHex(valid?0xd1f6b4:0xffa58a);marker.visible=Boolean(f.cursor);if(f.cursor){const p=gameToWorld(f.cursor.x,f.cursor.y);marker.position.set(p.x,.48,p.z);const radius=cards[f.selected].radius*WORLD_SCALE;marker.scale.setScalar(radius/.55);if(ghostCard!==f.selected){clearGhost();if(!spell){ghost=workshop.createUnit(f.selected,'player');ghostCard=f.selected;ghost.root.traverse(node=>{if(node instanceof T.Mesh){const clone=(node.material as T.Material).clone();clone.transparent=true;clone.opacity=.36;clone.depthWrite=false;ghostMaterials.push(clone);node.material=clone;node.castShadow=false;}});scene.add(ghost.root);}}if(ghost){ghost.root.position.set(p.x,.2,p.z);ghost.root.visible=Boolean(valid);ghost.animate({time:seconds,moving:false,attack:0,hit:0,death:0,reducedMotion:f.reducedMotion});ghost.root.scale.multiplyScalar(scaleOf(f.selected));}}}else{marker.visible=false;if(ghost)clearGhost();}
  if(comet){if(resolved==='low'||f.reducedMotion){comet.reset();comets.clear();}
   else{comet.update(seconds);for(const [id,end] of comets)if(seconds>=end)comets.delete(id);}}
  effects.finish(resolved==='high');
  motes.update(seconds,resolved,sky.active()&&!f.reducedMotion);
  if(sky.consumeShadowChange()||!sky.active())renderer.shadowMap.needsUpdate=true;
  renderer.info.reset();
  if(resolved==='high'&&sky.active()&&bloom)bloom.render();else renderer.render(scene,camera);
 },
 diagnostics(){return{calls:renderer.info.render.calls,triangles:renderer.info.render.triangles,geometries:renderer.info.memory.geometries,textures:renderer.info.memory.textures};},
 dispose(){if(disposed)return;disposed=true;stopWatchingContext();clearGhost();mixers.forEach(m=>{m.stopAllAction();m.uncacheRoot(m.getRoot());});importedGeos.forEach(g=>g.dispose());importedMats.forEach(m=>m.dispose());lod.dispose();workshop.dispose();world.dispose();sky.dispose();effects.dispose();comet?.dispose();comets.clear();library.dispose();geometry.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());scene.clear();figures.clear();free.clear();turrets.clear();projectiles.clear();projectilePool.length=0;motes.dispose();bloom?.dispose();renderer.renderLists.dispose();renderer.dispose();renderer.forceContextLoss();}
 };
}
