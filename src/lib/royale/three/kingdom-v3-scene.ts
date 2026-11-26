import * as T from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { FrameMeter, type GraphicsQuality } from '../quality';
import { makeCloudVolume } from './kingdom-cloud';
import { disposeKingdomScene, loadKingdomAsset } from './kingdom-resources';
import { makeKingdomWater, type WaterSite } from './kingdom-v3-water';

const root='/royale/kingdom-v3';
type PlantSite=[number,number,number,number,number];
type FlagSite=[number,number,number,number];
type Layout={trees:PlantSite[][];water:WaterSite[];flags:FlagSite[]};

function cloudMap(){
 const c=document.createElement('canvas');
 c.width=192;c.height=108;
 const context=c.getContext('2d')!;
 const lobes=[[39,70,28],[65,51,42],[88,59,45],[113,39,34],[132,51,32],[151,66,37],[98,70,42]];
 for(const [x,y,r] of lobes){
  const glow=context.createRadialGradient(x,y,0,x,y,r);
  glow.addColorStop(0,'rgba(238,244,255,.48)');
  glow.addColorStop(.37,'rgba(219,229,246,.28)');
  glow.addColorStop(1,'rgba(185,204,241,0)');
  context.fillStyle=glow;context.fillRect(x-r,y-r,r*2,r*2);
 }
 const texture=new T.CanvasTexture(c);texture.colorSpace=T.SRGBColorSpace;
 return texture;
}

function kingFlags(sites:FlagSite[]){
 const group=new T.Group();
 const material=new T.ShaderMaterial({
  side:T.DoubleSide,uniforms:{uWind:{value:0}},
  vertexShader:`varying vec2 vUv; uniform float uWind; void main(){
   vUv=uv; vec3 p=position;
   p.z+=sin(uv.x*8.+uWind*2.1+modelMatrix[3].x)*.19*uv.x;
   p.y+=cos(uv.x*8.+uWind*2.1)*.061*uv.x;
   gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);
  }`,
  fragmentShader:`varying vec2 vUv; uniform float uWind;
   void main(){
    float x=vUv.x,y=vUv.y;
    float notch=clamp((x-.72)/.28,0.,1.)*.26;
    if(abs(y-.5)>.49-notch)discard;
    float binding=step(.423-notch,abs(y-.5));
    vec2 p=(vUv-vec2(.34,.51))*vec2(1.95,1.);
    float crest=1.-smoothstep(.029,.053,abs(abs(p.x)+abs(p.y)*.62-.16));
    float satin=.64+.31*sin(x*8.5+uWind*2.1)+.028*sin(x*390.)*cos(y*360.);
    vec3 dye=vec3(.029,.086,.31)*(satin+.27);
    vec3 gold=vec3(.77,.44,.13)*(.83+.29*satin);
    gl_FragColor=vec4(mix(dye,gold,max(binding,crest*.85)),1.);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
   }`,
 });
 const poleMat=new T.MeshStandardMaterial({color:0xbc8b49,metalness:.73,roughness:.41});
 const poleGeo=new T.CylinderGeometry(.015,.022,.57,7);
 const flagGeo=new T.PlaneGeometry(.82,.29,12,4);
 sites.forEach(([x,y,z,scale],i)=>{
  const pole=new T.Mesh(poleGeo,poleMat);
  pole.position.set(x,z+.27*scale,-y);pole.scale.setScalar(scale);
  const flag=new T.Mesh(flagGeo,material);
  flag.position.set(x+.41*scale,z+.44*scale,-y);flag.scale.setScalar(scale);
  flag.rotation.y=(i%3-1)*.18;
  group.add(pole,flag);
 });
 return {group,material};
}

function makeGroves(world:T.Group,sites:PlantSite[][],reduced:boolean,wind:{value:number}){
 const batch=new T.Group(), groups:T.InstancedMesh[]=[];
 const worldTransform=new T.Object3D();
 const leafMaterials=new Set<T.MeshStandardMaterial>();
 sites.forEach((positions,index)=>{
  const source=world.getObjectByName('VEG_'+index);
  if(!source)return;
  const placements=reduced?positions.filter((_,i)=>i%3!==1):positions;
  source.updateMatrixWorld(true);
  source.traverse(obj=>{
   if(!(obj instanceof T.Mesh))return;
   const mesh=new T.InstancedMesh(obj.geometry,obj.material,placements.length);
   placements.forEach(([x,y,z,scale,rotate],i)=>{
    worldTransform.position.set(x,z,-y);
    worldTransform.rotation.y=rotate;
    worldTransform.scale.setScalar(scale);
    worldTransform.updateMatrix();
    mesh.setMatrixAt(i,worldTransform.matrix.multiply(obj.matrixWorld));
   });
   mesh.computeBoundingSphere();
   mesh.receiveShadow=!reduced;
   mesh.castShadow=!reduced&&index<5;
   groups.push(mesh);batch.add(mesh);
   if(obj.material instanceof T.MeshStandardMaterial&&obj.material.name==='Foliage atlas'){
    const material=obj.material;
    material.side=T.DoubleSide;
    if(!leafMaterials.has(material)){
     leafMaterials.add(material);
     material.onBeforeCompile=shader=>{
      shader.uniforms.uBreeze=wind;
      shader.vertexShader='uniform float uBreeze;\n'+shader.vertexShader;
      shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`
       #include <begin_vertex>
       float flutter=sin(uBreeze*1.31+position.y*.64+instanceMatrix[3].x*.43);
       transformed.x+=flutter*max(0.,position.y+.55)*.047;
       transformed.z+=cos(uBreeze*.95+instanceMatrix[3].z)*max(0.,position.y+.55)*.024;
      `);
     };
     material.customProgramCacheKey=()=> 'royale-wind-v3';
    }
   }
  });
  source.removeFromParent();
 });
 // Painted grass shares the atlas. Use a separate shader program for the non-instanced geometry.
 world.traverse(obj=>{
  if(obj instanceof T.Mesh&&obj.material instanceof T.MeshStandardMaterial&&leafMaterials.has(obj.material)){
   obj.material=obj.material.clone();obj.material.side=T.DoubleSide;
  }
 });
 return {batch,groups};
}

const birdVertex=`
 uniform float uTime;
 void main(){
  vec3 p=position;
  p.y+=sin(uTime*10.+instanceMatrix[3].x*.8)*abs(p.x)*.77;
  gl_Position=projectionMatrix*modelViewMatrix*instanceMatrix*vec4(p,1.);
 }
`;
const birdFragment=`void main(){gl_FragColor=vec4(.20,.28,.42,.71);}`;

export function mountKingdomV3Scene(canvas:HTMLCanvasElement,quality:GraphicsQuality,onReady:()=>void,onError:()=>void){
 const auto=quality==='auto';
 const cores=navigator.hardwareConcurrency||6;
 const memory=(navigator as Navigator&{deviceMemory?:number}).deviceMemory;
 const low=quality==='low'||(auto&&(cores<=4||(memory??6)<=4));
 const high=quality==='high'||(auto&&!low&&innerWidth>=950&&cores>=8);
 const renderer=new T.WebGLRenderer({canvas,antialias:!low,alpha:true,powerPreference:low?'low-power':'default'});
 renderer.toneMapping=T.ACESFilmicToneMapping;
 renderer.toneMappingExposure=1.00;
 renderer.shadowMap.enabled=!low;
 renderer.shadowMap.type=T.PCFShadowMap;
 renderer.shadowMap.autoUpdate=false;
 const scene=new T.Scene();
 scene.fog=new T.Fog(0xa2b5d6,23,42);
 const camera=new T.PerspectiveCamera(32,1,.12,75);
 const stage=canvas.parentElement;
 const hemi=new T.HemisphereLight(0xb9d5ff,0x534e62,1.13);
 const sun=new T.DirectionalLight(0xffcea0,3.2);
 sun.position.set(-8,11,7);
 sun.castShadow=!low;
 sun.shadow.mapSize.setScalar(high?1536:768);
 Object.assign(sun.shadow.camera,{left:-7,right:7,top:7,bottom:-7,near:1,far:30});
 sun.shadow.normalBias=.043;sun.shadow.bias=-.0002;sun.shadow.radius=3.4;
 const cool=new T.DirectionalLight(0xa5c7fc,1.20);
 cool.position.set(8,8,-6);
 scene.add(hemi,sun,cool);
 const generator=!low?new T.PMREMGenerator(renderer):undefined;
 const environment=generator?new RoomEnvironment():undefined;
 const reflected=generator&&environment?generator.fromScene(environment,.075):undefined;
 environment?.dispose();generator?.dispose();
 if(reflected){scene.environment=reflected.texture;scene.environmentIntensity=.40;}

 const skyCloud=cloudMap();
 const atmosphere=new T.Group();
 scene.add(atmosphere);
 const distant=[[-10.1,-1.8,-5.5,6.3],[-5.5,-2.05,-5.6,5.3],[2.44,-3.65,-2.1,5.6],[7.47,-3.22,.85,5.9],
  [-7.1,-3.97,4.05,5.1],[6.3,-4.07,4.47,5.6],[-1.5,-5.35,4.30,6.2],[10.58,.65,-8.7,5.5]];
 const cloudBanks=distant.slice(0,low?6:8).map(([x,y,z,w],i)=>{
  const sprite=new T.Sprite(new T.SpriteMaterial({map:skyCloud,color:i%3===0?0xd0c9e4:0xdce8ff,
   transparent:true,depthWrite:false,opacity:i<3?.34:.50}));
  sprite.position.set(x,y,z);sprite.scale.set(w,w*.37,1);sprite.renderOrder=2;
  atmosphere.add(sprite);
  return {x,y,sprite};
 });
 const volumes=high?[[-6.5,-4.5,4.8,3.83],[6.4,-4.8,4.63,3.9],[-7.12,-1.34,-8.6,3.2]].map(([x,y,z,s])=>{
  const cloud=makeCloudVolume();
  cloud.position.set(x,y,z);cloud.scale.set(s,.72,1.52);cloud.renderOrder=3;atmosphere.add(cloud);
  return {cloud,x};
 }):[];

 const birds=new T.InstancedMesh(new T.BufferGeometry(),new T.ShaderMaterial({
  uniforms:{uTime:{value:0}},side:T.DoubleSide,transparent:true,depthWrite:false,vertexShader:birdVertex,fragmentShader:birdFragment,
 }),low?3:7);
 birds.geometry.setAttribute('position',new T.Float32BufferAttribute([-.23,.026,0,0,0,.056,-.074,-.018,-.038,0,0,.056,.23,.026,0,.076,-.018,-.038],3));
 birds.frustumCulled=false;birds.renderOrder=6;scene.add(birds);
 const abort=new AbortController();
 const wind={value:0},aim=new T.Vector3(),location=new T.Vector3(),eye=new T.Vector3(),scratch=new T.Object3D();
 const meter=new FrameMeter();
 let visible=true,painted=false,disposed=false,frame=0,ready=false,frames=0,last=0,first=0,mouse=0,pointer=0;
 const idealDpr=low?1:high?1.58:1.28;
 let budgetDpr=Math.min(devicePixelRatio||1,idealDpr);
 let water:ReturnType<typeof makeKingdomWater>|undefined;
 let flags:ReturnType<typeof kingFlags>|undefined;
 let instancing:T.InstancedMesh[]=[];
 let hitTimer=0;
 function sizing(){
  const w=canvas.clientWidth,h=canvas.clientHeight;
  if(!w||!h)return;
  camera.aspect=w/h;
  camera.fov=T.MathUtils.radToDeg(Math.max(.50,2*Math.atan(.287/camera.aspect)));
  camera.updateProjectionMatrix();
  renderer.setPixelRatio(budgetDpr);
  renderer.setSize(w,h,false);
 }
 const resize=new ResizeObserver(sizing);
 resize.observe(canvas);
 const observer=new IntersectionObserver(([entry])=>{visible=entry.isIntersecting;last=0;meter.reset();});
 observer.observe(canvas);
 function track(event:PointerEvent){
  if(event.pointerType!=='mouse')return;
  const box=canvas.getBoundingClientRect();
  mouse=(event.clientX-box.left)/box.width-.5;
 }
 stage?.addEventListener('pointermove',track);
 const onContextLost=(event:Event)=>{event.preventDefault();onError();};
 canvas.addEventListener('webglcontextlost',onContextLost);

 function draw(time:number){
  frame=requestAnimationFrame(draw);
  if(!ready||!visible||document.hidden||time-last<(low?31:14))return;
  if(last)meter.push(time-last);
  last=time;first ||= time;
  const elapsed=(time-first)/1000;
  if(auto&&!low&&elapsed-hitTimer>4&&meter.ready&&meter.fps<49&&budgetDpr>.78){
   hitTimer=elapsed;budgetDpr=Math.max(.78,budgetDpr*.88);sizing();
  }
  pointer=T.MathUtils.lerp(pointer,mouse,.047);
  const tilt=-.36+.02*Math.sin(elapsed*.24)+pointer*.125;
  const launch=canvas.closest('[data-launching="true"]')!==null;
  const distance=22.9+Math.exp(-elapsed*2.45)*1.04-(launch?1.18:0);
  location.set(distance*Math.sin(tilt),7.35+.17*Math.sin(elapsed*.42),distance*Math.cos(tilt));
  if(painted)camera.position.lerp(location,.062);
  else camera.position.copy(location);
  aim.set(-.20,camera.aspect<.82?1.15:1.45,.18);camera.lookAt(aim);
  wind.value=elapsed;
  const dusk=Math.sin(elapsed*.12);
  cloudBanks.forEach(({sprite,x,y},i)=>{
   sprite.position.x=x+.49*Math.sin(elapsed*.15+i);
   sprite.position.y=y+.10*Math.cos(elapsed*.18+i*2);
  });
  volumes.forEach(({cloud,x},i)=>{
   cloud.position.x=x+.33*Math.sin(elapsed*.09+i);
   cloud.material.uniforms.uEye.value.copy(cloud.worldToLocal(eye.copy(camera.position)));
  });
  for(let i=0;i<birds.count;i++){
   const q=elapsed*.26+i*.34;
   scratch.position.set(-1.4+8.7*Math.sin(q*.53),3.55+.63*Math.sin(q*1.65)+i*.14,-5.8-i*.44);
   scratch.rotation.set(.10,Math.cos(q*.53)*1.44,.15*Math.sin(q*4));scratch.scale.setScalar(.91);
   scratch.updateMatrix();birds.setMatrixAt(i,scratch.matrix);
  }
  birds.instanceMatrix.needsUpdate=true;
  birds.material.uniforms.uTime.value=elapsed;
  if(flags)flags.material.uniforms.uWind.value=elapsed;
  water?.update(elapsed);
  sun.intensity=3.2+dusk*.043;
  if(!low&&frames%(high?11:19)===0)renderer.shadowMap.needsUpdate=true;
  renderer.render(scene,camera);
  frames++;
  if(frames%20===1){
   canvas.dataset.sceneFrames=String(frames);canvas.dataset.sceneTime=String(time);
   canvas.dataset.sceneDraws=String(renderer.info.render.calls);canvas.dataset.sceneTriangles=String(renderer.info.render.triangles);
  }
  if(!painted){painted=true;onReady();}
 }

 async function load(){
  const layoutReady=fetch(root+'/layout.json',{signal:abort.signal,cache:'force-cache'}).then(async response=>{
   if(!response.ok)throw Error('Не удалось загрузить расположение объектов');
   return await response.json() as Layout;
  });
  const [settled,loaded]=await Promise.allSettled([layoutReady,
   loadKingdomAsset(root+'/environment-'+(low?'low':high?'high':'medium')+'.glb',abort.signal)]);
  if(loaded.status==='rejected')throw loaded.reason;
  const asset=loaded.value;
  if(settled.status==='rejected'){disposeKingdomScene(asset.scene);throw settled.reason;}
  const layout=settled.value;
  if(disposed){disposeKingdomScene(asset.scene);return;}
  const grove=makeGroves(asset.scene,layout.trees,low,wind);
  instancing=grove.groups;
  asset.scene.traverse(node=>{
   if(node instanceof T.Mesh){
    node.castShadow=!low&&!node.name.includes('Distant')&&!node.name.includes('Foreground');
    node.receiveShadow=!low;
    if(node.material instanceof T.MeshStandardMaterial){
     if(node.material.name==='Foliage atlas')node.material.side=T.DoubleSide;
     if(node.material.name==='Cerulean vein crystal'&&!low)node.material.envMapIntensity=.24;
    }
   }
  });
  water=makeKingdomWater(layout.water,skyCloud,low,high);
  flags=kingFlags(layout.flags);
  scene.add(asset.scene,grove.batch,water.root,flags.group);
  ready=true;
 }
 void load().catch(()=>{if(!disposed&&!abort.signal.aborted)onError();});
 sizing();
 frame=requestAnimationFrame(draw);
 return ()=>{
  disposed=true;abort.abort();cancelAnimationFrame(frame);resize.disconnect();observer.disconnect();
  stage?.removeEventListener('pointermove',track);canvas.removeEventListener('webglcontextlost',onContextLost);
  water?.dispose();birds.geometry.dispose();birds.material.dispose();birds.dispose();
  cloudBanks.forEach(({sprite})=>sprite.material.dispose());
  instancing.forEach(instance=>instance.dispose());
  disposeKingdomScene(scene);skyCloud.dispose();reflected?.dispose();sun.shadow.dispose();
  renderer.renderLists.dispose();renderer.dispose();
 };
}
