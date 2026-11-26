import * as T from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { clone } from 'three/addons/utils/SkeletonUtils.js';
import type { CardId } from '../config';
import { cards, isSpell } from '../config';
import { initialAutoQuality, type KingdomQuality } from '../quality';
import { figureAsset } from './figure-assets';
import { disposeKingdomScene, loadKingdomAsset } from './kingdom-resources';
import { makeScienceHall } from './science-hall';

const accents: Partial<Record<CardId, number>> = {
 knight:0xffc26e, dragon:0x639fff, mage:0xa98bff, giant:0xdca778, frost:0x9adfff,
 ember:0xff9d42, fireball:0xff743e, meteor:0xac73ff, guardians:0xffb54b, archers:0x7db693,
 spears:0x70d8ea, sentinel:0xc581f2, skeletons:0xce9ffd, hunters:0xae8bdd, ballista:0x83bafa, rider:0xffad68,
};
const ground=.45;

function stageContact(){
 const canvas=document.createElement('canvas');canvas.width=canvas.height=96;
 const context=canvas.getContext('2d')!;
 const gradient=context.createRadialGradient(48,48,1,48,48,47);
 gradient.addColorStop(0,'#040714a8');gradient.addColorStop(.58,'#05071158');gradient.addColorStop(1,'#03071600');
 context.fillStyle=gradient;context.fillRect(0,0,96,96);
 return new T.CanvasTexture(canvas);
}

function podium(low:boolean){
 const root=new T.Group();
 const rock=new T.MeshStandardMaterial({color:0x273852,roughness:.54,metalness:.20});
 const patina=new T.MeshStandardMaterial({color:0x122038,roughness:.61,metalness:.1});
 const gold=new T.MeshStandardMaterial({color:0xd59645,metalness:.75,roughness:.36});
 const light=new T.MeshBasicMaterial({color:0xf0b957,transparent:true,opacity:.7});
 const horizontal=(geometry:T.BufferGeometry,material:T.Material,y:number)=>{
  const mesh=new T.Mesh(geometry,material);mesh.position.y=y;mesh.receiveShadow=!low;root.add(mesh);return mesh;
 };
 const segments=low?36:72;
 for(const [rt,rb,h,y,m] of [[1.92,2.10,.12,.07,patina],[1.87,1.92,.08,.17,gold],[1.84,1.88,.16,.292,rock],[1.80,1.85,.045,.40,gold],[1.78,1.82,.029,.429,patina]] as const){
  horizontal(new T.CylinderGeometry(rt,rb,h,segments),m,y);
 }
 for(const [r,y] of [[1.78,.452],[1.65,.451],[.62,.452]]){
  horizontal(new T.TorusGeometry(r,.012,5,segments).rotateX(-Math.PI/2),r>1.7?light:gold,y);
 }
 for(let i=0;i<3;i++){
  const orbit=horizontal(new T.TorusGeometry(.54,.010,4,44).scale(1,.39,1).rotateX(-Math.PI/2),gold,.452);
  orbit.rotation.y=i*Math.PI/3;
 }
 for(let i=0;i<12;i++){
  const a=i*Math.PI/6;
  const stud=horizontal(new T.OctahedronGeometry(.045,0), gold,.453);
  stud.position.x=1.70*Math.cos(a);stud.position.z=1.70*Math.sin(a);
 }
 const contact=new T.Mesh(new T.PlaneGeometry(3.1,2.7),new T.MeshBasicMaterial({map:stageContact(),transparent:true,depthWrite:false}));
 contact.rotation.x=-Math.PI/2;contact.position.y=.453;root.add(contact);
 return {root,light,contact};
}

function makeMotes(count:number){
 const positions=new Float32Array(count*3), keys=new Float32Array(count);
 for(let i=0;i<count;i++){
  const q=i*2.399, r=1.33+.40*Math.sin(i*5.43);
  positions.set([Math.cos(q)*r,.55+(i*.593%1)*3.42,Math.sin(q)*r],i*3);
  keys[i]=i*.773;
 }
 const geometry=new T.BufferGeometry();
 geometry.setAttribute('position',new T.BufferAttribute(positions,3));geometry.setAttribute('key',new T.BufferAttribute(keys,1));
 const material=new T.ShaderMaterial({
  transparent:true,depthWrite:false,blending:T.AdditiveBlending,
  uniforms:{clock:{value:0},tint:{value:new T.Color(0xcd99ff)},strength:{value:1}},
  vertexShader:`uniform float clock; attribute float key; varying float alpha;
  void main(){float a=clock*.44+key;vec3 p=position;
   p.x+=sin(a)*.22;p.z+=cos(a*1.22)*.24;p.y+=sin(a*.81)*.49;
   vec4 view=modelViewMatrix*vec4(p,1.);gl_Position=projectionMatrix*view;
   gl_PointSize=clamp(51./-view.z,1.2,5.5);alpha=pow(.5+.5*sin(key*8.+clock*2.),2.8);}`,
  fragmentShader:`varying float alpha; uniform vec3 tint; uniform float strength;
  void main(){float r=length(gl_PointCoord-.5);float halo=1.-smoothstep(.06,.5,r);gl_FragColor=vec4(tint,halo*halo*alpha*strength);}`,
 });
 return {points:new T.Points(geometry,material),material,dispose(){geometry.dispose();material.dispose();}};
}

function magicAura(id:CardId, color:number, low:boolean){
 if(!isSpell(id)&&!['spears','mage','frost','ember'].includes(id))return undefined;
 const root=new T.Group(), spell=isSpell(id);
 const material=new T.MeshBasicMaterial({color,transparent:true,opacity:.39,blending:T.AdditiveBlending,depthWrite:false,side:T.DoubleSide});
 for(let i=0;i<(low?1:spell?3:2);i++){
  const radius=spell?1.12+i*.25:1.43+i*.12;
  const geometry=new T.TorusGeometry(radius,.025-i*.006,5,52,Math.PI*(1.23+i*.12));
  const ribbon=new T.Mesh(geometry,material);
  ribbon.rotation.set(Math.PI*.46+i*.37,i*.56,i*2.06);
  ribbon.position.y=spell?1.85:.52+i*.28;
  root.add(ribbon);
 }
 return root;
}

type Loaded = { group:T.Group; mixers:T.AnimationMixer[]; animations:T.AnimationClip[]; aura?:T.Group };
function releaseModel(model:Loaded){
 model.mixers.forEach(mixer=>{mixer.stopAllAction();mixer.uncacheRoot(mixer.getRoot());});
 model.group.removeFromParent();
 disposeKingdomScene(model.group);
 if(model.aura)disposeKingdomScene(model.aura);
 model.aura?.removeFromParent();
}

export function mountCollectionStage(canvas:HTMLCanvasElement, frame:HTMLElement, quality:KingdomQuality,
 onReady:(id:CardId,names:string[],active:string)=>void,onError:(id?:CardId)=>void){
 const screen=matchMedia('(prefers-reduced-motion: reduce)');
 const caps=navigator as Navigator&{deviceMemory?:number};
 const level=quality==='auto'?initialAutoQuality(innerWidth,caps.hardwareConcurrency||6,caps.deviceMemory):quality;
 const low=level==='low', ultra=level==='ultra', high=ultra||level==='high';
 const renderer=new T.WebGLRenderer({alpha:false,canvas,antialias:!low,powerPreference:low?'low-power':'default'});
 const scene=new T.Scene(),camera=new T.PerspectiveCamera(37,1,.08,55);
 scene.background=new T.Color(0x0c1629);scene.fog=new T.FogExp2(0x10192d,.028);
 renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.10;
 renderer.shadowMap.enabled=high;renderer.shadowMap.type=T.PCFShadowMap;
 renderer.shadowMap.autoUpdate=false;
 const room=high?new RoomEnvironment():undefined;
 const generator=room?new T.PMREMGenerator(renderer):undefined;
 const reflected=room&&generator?generator.fromScene(room,.08):undefined;
 if(reflected){scene.environment=reflected.texture;scene.environmentIntensity=.57;}
 room?.dispose();generator?.dispose();
 const hall=makeScienceHall(level), stand=podium(low);
 const motes=makeMotes(low?22:ultra?135:high?86:48);
 scene.add(hall.root,stand.root,motes.points,new T.HemisphereLight(0xb2ccfc,0x6f4137,1.47));
 const key=new T.DirectionalLight(0xffdfb2,3.1);key.position.set(-3,6,5);key.castShadow=high;
 key.shadow.mapSize.setScalar(ultra?1536:1024);
 Object.assign(key.shadow.camera,{left:-3.3,right:3.3,bottom:-3.3,top:3.3,far:20});
 key.shadow.normalBias=.023; key.shadow.bias=-.00022; key.shadow.radius=3;
 const fill=new T.DirectionalLight(0x82abff,1.49);fill.position.set(3,5,-6);
 const rim=new T.PointLight(0x738dff,high?38:23,10,2);rim.position.set(2.65,2.83,-1.9);
 const glow=new T.PointLight(0xffad60,29,13,2);glow.position.set(-2.8,1.72,3);
 scene.add(key,fill,rim,glow);

 let model:Loaded|undefined, disposed=false, selected:CardId|undefined, pending:AbortController|undefined;
 let rotation=0, targetRotation=0, zoom=1, targetZoom=1, distance=10, width=1,height=1;
 let visible=true, animation=0, last=0, time=0, frames=0, stamp=0, born=0, dirty=true;
 let frameAverage=0;
 let viewScale=Math.min((devicePixelRatio||1)*(ultra?1.15:1),low?1:ultra?1.75:high?1.46:1.15);
 const cameraAim=new T.Vector3(0,2.0,0);
 const renderCamera=()=>{camera.position.set(.38,distance*.17+2.28,distance*zoom);camera.lookAt(cameraAim);};
 const sizing=()=>{
  const bounds=canvas.getBoundingClientRect(), subject=frame.getBoundingClientRect();
  width=Math.round(bounds.width);height=Math.round(bounds.height);
  if(!width||!height||!subject.width||!subject.height)return;
  const centerX=subject.left+subject.width*.5-bounds.left;
  const centerY=subject.top+subject.height*.48-bounds.top;
  const worldHeight=Math.max(4.55*height/subject.height,4.85*height/subject.width);
  distance=worldHeight/(2*Math.tan(T.MathUtils.degToRad(camera.fov*.5)));
  camera.setViewOffset(width,height,width/2-centerX,height/2-centerY,width,height);
  renderer.setPixelRatio(viewScale);renderer.setSize(width,height,false);
  renderCamera();dirty=true;
 };
 const resize=new ResizeObserver(sizing);resize.observe(canvas);resize.observe(frame);
 const observer=new IntersectionObserver(([entry])=>{visible=entry.isIntersecting;last=0;dirty=true;});observer.observe(canvas);
 const lose=(event:Event)=>{event.preventDefault();onError(selected);};
 canvas.addEventListener('webglcontextlost',lose);
 screen.addEventListener('change',motionChange);
 function motionChange(){dirty=true;}
 let activeClip='';
 function play(name:string){
  const clip=model?.animations.find(item=>item.name===name);
  if(!clip||!model)return;
  model.mixers.forEach((mixer,i)=>{
   mixer.stopAllAction();
   const action=mixer.clipAction(clip).reset().play();
   action.time=Math.min(.14*i,clip.duration*.24);
   if(screen.matches)mixer.update(0);
  });
  activeClip=name;dirty=true;
 }
 function choose(id:CardId){
  if(disposed)return;
  selected=id;pending?.abort();
  const controller=new AbortController();pending=controller;
  const url=figureAsset(id,ultra?'high':level);
  const urls=id==='hunters'?[url,figureAsset('hunters-silver',ultra?'high':level)]:[url];
  // At most the selected card's assets may coexist with the previous display during a switch.
  void Promise.allSettled(urls.map(path=>loadKingdomAsset(path,controller.signal))).then(results=>{
   const assets=results.flatMap(result=>result.status==='fulfilled'?[result.value]:[]);
   if(controller.signal.aborted||disposed||assets.length!==urls.length){
    assets.forEach(asset=>disposeKingdomScene(asset.scene));
    if(!disposed&&!controller.signal.aborted)onError(id);
    return;
   }
   const count=Math.max(1,cards[id].count), group=new T.Group(), mixers:T.AnimationMixer[]=[];
   const primary=assets[0], clips=primary.animations;
   for(let i=0;i<count;i++){
    const asset=assets[i===1&&assets.length>1?1:0];
    const avatar=i===0?asset.scene:clone(asset.scene);
    const facing=new T.Group(), oriented=new T.Group();
    oriented.rotation.y=id==='rider'?.57:id==='dragon'?.36:id==='ballista'?.34:0;
    oriented.add(avatar);facing.add(oriented);facing.updateMatrixWorld(true);
    const bounds=new T.Box3().setFromObject(facing), size=bounds.getSize(new T.Vector3()),center=bounds.getCenter(new T.Vector3());
    if(bounds.isEmpty()||!Number.isFinite(size.lengthSq()))continue;
    const hover=isSpell(id)||id==='spears';
    const scale=count===1?Math.min((hover?2.42:3.30)/Math.max(.18,size.y),3.55/Math.max(.18,size.x,size.z))
      :Math.min((id==='spears'?1.72:2.15)/Math.max(.18,size.y),1.26/Math.max(.18,size.x,size.z));
    const row=count===2?(i===0?-.62:.62):i===0?0:i===3?.02:(i%2?-1.04:1.04);
    facing.position.set(count===1?0:row,ground+(hover?.47:0)+(i===3?.12:0),i===0?.34:i===3?-1.18:count===2?-.10:-.40);
    const wrapper=new T.Group();wrapper.scale.setScalar(scale);facing.add(wrapper);
    const align=new T.Group();align.position.set(-center.x,-bounds.min.y,-center.z);align.add(oriented);wrapper.add(align);
    facing.rotation.y=count===1?-.22:row*.16-.08;
    avatar.traverse(node=>{if(node instanceof T.Mesh){node.castShadow=high;node.receiveShadow=high;}});
    group.add(facing);mixers.push(new T.AnimationMixer(avatar));
   }
   if(!group.children.length){
    assets.forEach(asset=>disposeKingdomScene(asset.scene));onError(id);return;
   }
   // Only objects present in the display own GPU geometry. Variant clones have independent bones.
   const color=accents[id]??0xe9ad68;
   const aura=magicAura(id,color,low);
   if(model)releaseModel(model);
   model={group,mixers,animations:clips,aura};
   scene.add(group);if(aura)scene.add(aura);
   rim.color.setHex(color);motes.material.uniforms.tint.value.setHex(color);
   motes.material.uniforms.strength.value=1.2+(isSpell(id)?.8:0);
   stand.light.color.setHex(color);
   stand.contact.scale.set(count>1?1.12:.87,count>1?1.08:.92,1);
   rotation=targetRotation=0;zoom=targetZoom=1;born=time;activeClip='';
   const idle=clips.find(clip=>clip.name==='Idle')??clips.find(clip=>/hover|fly/i.test(clip.name));
   if(idle)play(idle.name);
   renderer.shadowMap.needsUpdate=true;dirty=true;
   canvas.dataset.figure=id;canvas.dataset.formation=String(group.children.length);
   onReady(id,clips.map(clip=>clip.name),activeClip);
  }).catch(()=>{if(!disposed&&!controller.signal.aborted)onError(id);});
 }
 function draw(ms:number){
  animation=requestAnimationFrame(draw);
  if(!visible||document.hidden)return;
  const quiet=screen.matches;
  if(quiet&&!dirty)return;
  if(last&&ms-last<(low?31:14))return;
  const delta=last?Math.min((ms-last)/1000,.065):0;
  if(delta)frameAverage=T.MathUtils.lerp(frameAverage||delta,delta,.06);
  last=ms;
  if(!quiet)time+=delta;
  rotation=T.MathUtils.lerp(rotation,targetRotation,quiet?1:.23);
  zoom=T.MathUtils.lerp(zoom,targetZoom,quiet?1:.19);
  if(model){
   model.group.rotation.y=rotation;
   model.group.scale.setScalar(quiet?1:T.MathUtils.lerp(.965,1,T.MathUtils.smoothstep(time-born,0,.29)));
   if(!quiet)model.mixers.forEach(mixer=>mixer.update(delta));
   if(model.aura){model.aura.rotation.y=time*.51;model.aura.position.y=.11*Math.sin(time*1.6);}
  }
  rim.intensity=(high?37:23)+Math.sin(time*2.1)*1.8;
  stand.light.opacity=.64+.13*Math.sin(time*2.8);
  motes.material.uniforms.clock.value=time;
  hall.update(time);renderCamera();
  if(high&&(dirty||frames%12===0))renderer.shadowMap.needsUpdate=true;
  renderer.render(scene,camera);
  dirty=!quiet&&(Math.abs(zoom-targetZoom)>.001||Math.abs(rotation-targetRotation)>.002);
  frames++;
  if(frames%15===1){
   canvas.dataset.stageFrames=String(frames);canvas.dataset.stageTime=String(ms);
   canvas.dataset.stageDraws=String(renderer.info.render.calls);canvas.dataset.stageTriangles=String(renderer.info.render.triangles);
   canvas.dataset.stageGeometries=String(renderer.info.memory.geometries);canvas.dataset.stageTextures=String(renderer.info.memory.textures);
   canvas.dataset.stageQuality=level;canvas.dataset.stageAngle=rotation.toFixed(3);canvas.dataset.stageZoom=zoom.toFixed(3);
  }
  if(ultra&&frames-stamp>240&&frameAverage>.020&&viewScale>1.05){
   viewScale=Math.max(1.05,viewScale*.88);stamp=frames;sizing();
  }
 }
 const rotate=(change:number)=>{targetRotation+=change;dirty=true;};
 const magnify=(factor:number)=>{targetZoom=T.MathUtils.clamp(targetZoom*factor,.74,1.55);dirty=true;};
 const reset=()=>{targetRotation=0;targetZoom=1;dirty=true;};
 sizing();animation=requestAnimationFrame(draw);
 return {choose,play,rotate,zoom:magnify,reset,dispose(){
  disposed=true;pending?.abort();cancelAnimationFrame(animation);resize.disconnect();observer.disconnect();
  canvas.removeEventListener('webglcontextlost',lose);screen.removeEventListener('change',motionChange);
  if(model)releaseModel(model);
  hall.dispose();motes.dispose();
  disposeKingdomScene(scene);reflected?.dispose();key.shadow.dispose();
  renderer.renderLists.dispose();renderer.dispose();
 }};
}
