import * as T from 'three';
import { disposeKingdomScene, loadKingdomAsset } from './kingdom-resources';
import type { GraphicsQuality } from '../quality';
import { makeCloudVolume } from './kingdom-cloud';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const waterVertex = `
 varying vec2 vUv;
 uniform float uTime;
 void main(){
  vUv=uv;vec3 p=position;
  p.z+=sin(uv.y*17.0+uTime*2.0+uv.x*5.0)*.09;
  gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.0);
 }`;
const waterFragment = `
 varying vec2 vUv;
 uniform float uTime;
 uniform sampler2D uWater;
 void main(){
  float x=vUv.x,y=vUv.y;
  float ribbons=.52+.23*sin(x*44.+sin(y*8.-uTime*1.6)*1.9)+.2*sin(x*107.+y*22.-uTime*7.);
  float glints=pow(.5+.5*sin(x*33.+sin(y*17.+uTime*5.)*3.),5.);
  float fade=smoothstep(.0,.27,y)*smoothstep(.0,.12,x)*(1.-smoothstep(.84,1.,x));
  vec3 layer=texture2D(uWater,vec2(x,y*1.1+uTime*.28)).rgb;
  vec3 color=mix(vec3(.021,.27,.68),vec3(.48,.88,1.),clamp(ribbons*.66+glints*.27+layer.b*.24,0.,1.));
  gl_FragColor=vec4(color,fade*(.35+ribbons*.53));
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
 }`;

const rockColors = [0x465465,0x525973,0x696772,0x7e716c,0x67677b];
const leaves = [0x457635,0x2c5337,0x789042,0xa4af60,0x4b7840];
export function mountKingdomScene(canvas:HTMLCanvasElement,quality:GraphicsQuality,onReady:()=>void,onError:()=>void){
 const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
 const heavy=quality==='high'||(quality==='auto'&&innerWidth>=950&&(navigator.hardwareConcurrency||8)>=8);
 const economy=quality==='low'||(quality==='auto'&&(matchMedia('(max-width: 700px)').matches||(navigator.hardwareConcurrency||8)<6));
 const renderer=new T.WebGLRenderer({canvas,alpha:true,antialias:!economy||(innerWidth<=430&&(navigator.hardwareConcurrency||4)>=4),powerPreference:economy?'low-power':'default'});
 renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.06;
 const scene=new T.Scene(), island=new T.Group();
 renderer.shadowMap.enabled=!economy;renderer.shadowMap.type=T.PCFShadowMap;
 renderer.shadowMap.autoUpdate=false;
 const fog=new T.Fog(0x7c9fd1,19,39);scene.fog=fog;
 const environment=heavy?new RoomEnvironment():undefined;
 const probes=environment?new T.PMREMGenerator(renderer):undefined;
 const reflected=environment&&probes?probes.fromScene(environment,.065):undefined;
 environment?.dispose();probes?.dispose();
 if(reflected){scene.environment=reflected.texture;scene.environmentIntensity=.32;}
 scene.add(island,new T.HemisphereLight(0xaecbff,0x665d78,1.16));
 const sun=new T.DirectionalLight(0xffca91,3.55);sun.position.set(6,8,4);scene.add(sun);
 sun.castShadow=!economy;sun.shadow.mapSize.setScalar(heavy?1536:768);
 Object.assign(sun.shadow.camera,{left:-8,right:8,top:8,bottom:-8,near:.1,far:27});
 sun.shadow.normalBias=.035;sun.shadow.bias=-.0002;sun.shadow.radius=3.6;
 const rim=new T.DirectionalLight(0x91b9ff,1.95);rim.position.set(-6,5,-7);scene.add(rim);
 const camera=new T.PerspectiveCamera(32,1,.1,85);
 let seed=83;
 function rand(){seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;}
 const m=(color:number,metalness=0,roughness=.79)=>new T.MeshStandardMaterial({color,metalness,roughness,flatShading:true});
 const slate=m(0x958777), dark=m(0x34486e), bark=m(0x5b4330);
 const textureLoader=new T.TextureLoader();
 const painting=(name:string)=>{
  const map=textureLoader.load('/royale/kingdom/'+name+'.webp');
  map.colorSpace=T.SRGBColorSpace;map.wrapS=map.wrapT=T.RepeatWrapping;
  map.anisotropy=economy?1:Math.min(4,renderer.capabilities.getMaxAnisotropy());
  return map;
 };
 const rockPaint=painting('rock'), grassPaint=painting('meadow'), waterPaint=painting('cascade');
 function mesh(geometry:T.BufferGeometry,material:T.Material,x:number,y:number,z:number, parent:T.Object3D=island){
  const item=new T.Mesh(geometry,material);item.position.set(x,y,z);parent.add(item);return item;
 }
 const shapes=[40,40,40,40,40,40];
 const radius=[1,.975,.94,.72,.50,.12], levels=[.18,-.24,-.65,-1.58,-2.65,-3.68];
 const coordinates:number[][][]=shapes.map((segments,r)=>Array.from({length:segments},(_,i)=>{
  const a=i*Math.PI*2/segments+(r%2)*.075;
  const cr=radius[r]*(1+.10*Math.sin(5*a)+.08*Math.cos(3*a)+.10*(rand()-.5));
  return [Math.cos(a)*5.3*cr,levels[r]+(r>.1?(rand()-.5)*.37:0),Math.sin(a)*3.02*cr];
 }));
 const vertices:number[]=[], colors:number[]=[], uv:number[]=[];
 function face(c:number,a:number[],b:number[],d:number[],top=false){
  const color=new T.Color(c);vertices.push(...a,...b,...d);
  for(const v of [a,b,d]){colors.push(color.r,color.g,color.b);uv.push((v[0]+v[2]*.62)*.43,(top?v[2]:v[1])*.64);}
 }
 for(let j=0;j<shapes.length-1;j++){
  const a=coordinates[j],b=coordinates[j+1];
  for(let i=0;i<a.length;i++){
   const n=(i+1)%a.length;
   face(rockColors[Math.floor(rand()*5)],a[i],b[i],a[n]);
   face(rockColors[Math.floor(rand()*5)],a[n],b[i],b[n]);
  }
 }
 const cliffCount=vertices.length/3;
 for(let i=0;i<coordinates[0].length;i++){
  const next=(i+1)%coordinates[0].length;
  face([0x728652,0x748555,0x788954][i%3],coordinates[0][next],coordinates[0][i],[0,.24,0],true);
 }
 const cliff=new T.BufferGeometry();
 cliff.setAttribute('position',new T.Float32BufferAttribute(vertices,3));
 cliff.setAttribute('color',new T.Float32BufferAttribute(colors,3));
 cliff.setAttribute('uv',new T.Float32BufferAttribute(uv,2));cliff.computeVertexNormals();
 cliff.addGroup(0,cliffCount,0);cliff.addGroup(cliffCount,vertices.length/3-cliffCount,1);
 const rockSurface = new T.MeshStandardMaterial({map:rockPaint,vertexColors:true,flatShading:true,side:T.DoubleSide,roughness:.89});
 const turfSurface = new T.MeshStandardMaterial({map:grassPaint,vertexColors:true,flatShading:true,side:T.DoubleSide,roughness:1});
 island.add(new T.Mesh(cliff,[rockSurface,turfSurface]));
 for (const [x,y,z,scale] of [[-6.8,-.50,-7.9,.31],[6,-.7,-7.1,.28],[-5.4,-3.1,-1.6,.25]]){
  const shelf=new T.Mesh(cliff,[rockSurface,turfSurface]);
  shelf.position.set(x,y,z);shelf.scale.setScalar(scale);shelf.rotation.y=x*.18;scene.add(shelf);
 }
 const rockGeometry=new T.DodecahedronGeometry(1,0);
 const fragments=new T.InstancedMesh(rockGeometry,new T.MeshStandardMaterial({
  map:rockPaint,roughness:.92,flatShading:true}),economy?43:104);
 const helper=new T.Object3D();
 for(let i=0;i<fragments.count;i++){
  const a=rand()*Math.PI*2;
  const r=.87+rand()*.15;
  helper.position.set(Math.cos(a)*5*r,-.42-rand()*1.52,Math.sin(a)*2.85*r);
  helper.scale.set(.23+rand()*.50,.40+rand()*.90,.25+rand()*.45);
  helper.rotation.set(rand()*.62,rand()*6.3,rand()*.42);
  helper.updateMatrix();fragments.setMatrixAt(i,helper.matrix);
  fragments.setColorAt(i,new T.Color(rockColors[i%5]));
 }
 island.add(fragments);
 const courtyard=mesh(new T.CylinderGeometry(3,3.18,.30,16),slate,0,.23,-.24);
 courtyard.scale.z=.73;
 const base=mesh(new T.CylinderGeometry(2.85,3.04,.16,16),dark,0,.38,-.24);
 base.scale.z=.75;
 const paving=new T.InstancedMesh(new T.BoxGeometry(.40,.075,.28),m(0xffffff),35);
 for(let i=0;i<35;i++){
  helper.position.set((i%5-2)*.37,.28,1+Math.floor(i/5)*.25);
  helper.rotation.set(0,(rand()-.5)*.18,0);helper.scale.setScalar(1);helper.updateMatrix();
  paving.setMatrixAt(i,helper.matrix);paving.setColorAt(i,new T.Color([0x9286a1,0x8b8493,0xac9a9b][i%3]));
 }
 island.add(paving);
 const flagMeshes:T.Mesh<T.PlaneGeometry,T.ShaderMaterial>[]=[];
 const cloth=new T.ShaderMaterial({
  side:T.DoubleSide,
  uniforms:{uTime:{value:0},uTint:{value:new T.Color(0x17418c)}},
  vertexShader:`varying vec2 vUv;uniform float uTime;
   void main(){vUv=uv;vec3 p=position;p.z+=sin(uv.x*7.+uTime*3.)*.18*uv.x;gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);}`,
  fragmentShader:`varying vec2 vUv;uniform vec3 uTint;uniform float uTime;void main(){
   float cut=.5-max(0.,vUv.x-.72)*1.28;
   if(abs(vUv.y-.5)>cut)discard;
   float trim=step(cut-.058,abs(vUv.y-.5));
   vec2 f=vUv-vec2(.39,.5);
   float seal=1.-smoothstep(.025,.045,abs(abs(f.x)+abs(f.y)*.56-.122));
   float light=.73+.29*cos(vUv.x*8.+uTime*3.);
   gl_FragColor=vec4(mix(uTint*light,vec3(.91,.56,.16),max(trim,seal*.8)),1.);
   #include <colorspace_fragment>
  }`,
 });
 for(const [x,y,z,angle,scale] of [[0,5.44,-1.74,-.19,1.05],[-1.42,4.54,-1.02,.17,.84],[1.57,4.21,-1.15,-.35,.92],[-2.42,3.15,.05,.13,.67],[2.46,3.39,-.07,.23,.73]]){
  const flag=new T.Mesh(new T.PlaneGeometry(.79,.33,12,4),cloth);
  flag.position.set(x+.34*scale,y,z);flag.rotation.y=angle;flag.scale.setScalar(scale);
  island.add(flag);flagMeshes.push(flag);
 }
 const ledge=new T.InstancedMesh(new T.BoxGeometry(.25,.16,.41),m(0xe0c399),38);
 for(let i=0;i<ledge.count;i++){
  const side=i<19?-1:1,step=i%19;
  helper.position.set(side*(.84+step*.19),.29+Math.sin(step*.30)*.04,1.83+Math.sin(step*.18)*.60);
  helper.rotation.set(0,-side*Math.cos(step*.18)*.38,0);helper.scale.setScalar(1);helper.updateMatrix();
  ledge.setMatrixAt(i,helper.matrix);
 }
 island.add(ledge);
 const treeCount=economy?17:34,crownParts=economy?5:8;
 const crowns=new T.InstancedMesh(new T.IcosahedronGeometry(1,1),new T.MeshStandardMaterial({color:0xffffff,roughness:1,flatShading:false}),treeCount*crownParts);
 const branches=new T.InstancedMesh(new T.CylinderGeometry(.024,.055,1,5),bark,treeCount*3);
 const trunks=new T.InstancedMesh(new T.CylinderGeometry(.038,.09,1,7),bark,treeCount);
 for(let i=0;i<treeCount;i++){
  const a=i/treeCount*Math.PI*2+.12;
  let x=Math.cos(a)*(3.35+rand()*1.35);
  const z=Math.sin(a)*(1.97+rand()*.62);
  if(z>1.2&&Math.abs(x)<1.2)x=(x<0?-1:1)*(1.48+Math.abs(x)*.49);
  const h=z>1.5?.32+rand()*.49:.49+rand()*.93;
  helper.position.set(x,.20+h*.41,z);helper.scale.set(h,h,h);helper.rotation.set(.13,0,(rand()-.5)*.27);helper.updateMatrix();trunks.setMatrixAt(i,helper.matrix);
  for(let j=0;j<3;j++){
   const angle=j*Math.PI*2/3+i;
   helper.position.set(x+h*.14*Math.cos(angle),.25+h*.53,z+h*.14*Math.sin(angle));
   helper.rotation.set(.72*Math.sin(angle),0,-.72*Math.cos(angle));
   helper.scale.set(h,h*.45,h);helper.updateMatrix();branches.setMatrixAt(i*3+j,helper.matrix);
  }
  for(let j=0;j<crownParts;j++){
   const angle=j/crownParts*6.28;
   helper.position.set(x+Math.cos(angle)*h*.20,.33+h*(.76+rand()*.25),z+Math.sin(angle)*h*.22);
   helper.scale.set(h*(.19+rand()*.128),h*(.16+rand()*.15),h*(.28+rand()*.13));helper.rotation.set(rand(),rand()*2,rand());helper.updateMatrix();
   crowns.setMatrixAt(i*crownParts+j,helper.matrix);crowns.setColorAt(i*crownParts+j,new T.Color(leaves[(i+j)%5]));
  }
 }
 island.add(trunks,branches,crowns);
 const turf=new T.InstancedMesh(new T.IcosahedronGeometry(1,0),m(0xffffff),economy?35:83);
 for(let i=0;i<turf.count;i++){
  const a=rand()*Math.PI*2,r=.58+rand()*.37;
  helper.position.set(Math.cos(a)*5.3*r,.20+rand()*.12,Math.sin(a)*2.65*r);
  helper.rotation.set(0,rand()*6.3,0);helper.scale.set(.095+rand()*.40,.04+rand()*.08,.14+rand()*.28);
  helper.updateMatrix();turf.setMatrixAt(i,helper.matrix);turf.setColorAt(i,new T.Color(leaves[i%leaves.length]));
 }
 island.add(turf);
 const foreground=new T.Group();scene.add(foreground);
 for(const [x,y,z,q] of [[-8.38,-3.55,4,.58],[8.1,-4.65,5,.44],[-11.4,-2,-6,.39],[10,-1.0,-9,.32]]){
  const ledge=new T.Mesh(cliff,[rockSurface,turfSurface]);
  ledge.position.set(x,y,z);ledge.scale.setScalar(q);ledge.rotation.y=x*.37;foreground.add(ledge);
  if(economy)continue;
  for(let j=0;j<4;j++){
   const crown=mesh(crowns.geometry,m(leaves[j]),x+(j-1.5)*.33,y+.22+j*.106,z+.32,foreground);
   crown.scale.set(.58,.46,.52);
  }
 }
 const puff=document.createElement('canvas');puff.width=puff.height=128;
 const ctx=puff.getContext('2d')!;
 const texture=new T.CanvasTexture(puff);texture.colorSpace=T.SRGBColorSpace;
 for (let i=0;i<10;i++){
  const x=60+(rand()-.5)*63,y=63+(rand()-.5)*43,r=22+rand()*24;
  const gradient=ctx.createRadialGradient(x,y,0,x,y,r);
  gradient.addColorStop(0,'rgba(255,242,255,.7)');gradient.addColorStop(.34,'rgba(215,197,255,.42)');gradient.addColorStop(1,'rgba(195,168,255,0)');
  ctx.fillStyle=gradient;ctx.fillRect(x-r,y-r,r*2,r*2);
 }
 const shadowCanvas=document.createElement('canvas');shadowCanvas.width=shadowCanvas.height=64;
 const ink=shadowCanvas.getContext('2d')!;
 const groundGradient=ink.createRadialGradient(32,32,4,32,32,31);
 groundGradient.addColorStop(0,'rgba(14,30,51,.64)');groundGradient.addColorStop(1,'rgba(14,30,51,0)');
 ink.fillStyle=groundGradient;ink.fillRect(0,0,64,64);
 const shade=new T.InstancedMesh(new T.PlaneGeometry(1,1),new T.MeshBasicMaterial({
  map:new T.CanvasTexture(shadowCanvas),transparent:true,depthWrite:false,
  opacity:economy?.66:.50,polygonOffset:true,polygonOffsetFactor:-1,
 }),treeCount+1);
 for(let i=0;i<treeCount;i++){
  trunks.getMatrixAt(i,helper.matrix);helper.matrix.decompose(helper.position,helper.quaternion,helper.scale);
  helper.position.setY(.253);helper.rotation.set(-Math.PI/2,0,0);
  helper.scale.setScalar(Math.max(.55,helper.scale.y*.87));helper.updateMatrix();shade.setMatrixAt(i,helper.matrix);
 }
 helper.position.set(0,.253,-.15);helper.scale.set(6.38,4.8,1);helper.updateMatrix();shade.setMatrixAt(treeCount,helper.matrix);
 island.add(shade);
 const clouds=Array.from({length:economy?6:10},(_,i)=>{
  const cloud=new T.Sprite(new T.SpriteMaterial({map:texture,color:i<3?0xc5dcfb:0xe0ccec,transparent:true,depthWrite:false,opacity:i<2?.39:.53}));
  const x=(i%5-2)*3.3+(rand()-.5)*1.9;
  cloud.position.set(x,-2.4+(rand()-.5)*1.7,i<3?4.9:-4.8-rand()*3.4);
  cloud.scale.set(3.1+rand()*2.0,1.36+rand()*.61,1);scene.add(cloud);
  return {cloud,x,offset:rand()*6.28};
 });
 const cloudVolumes=heavy?[[-5.8,-2.8,5.2],[5.6,-3.4,4.9],[-3.7,-2.3,-6.4]].map(([x,y,z])=>{
  const cloud=makeCloudVolume();
  cloud.position.set(x,y,z);
  cloud.scale.set(2.85,.84,1.25);
  scene.add(cloud);
  return {cloud,x};
 }):[];
 const rays=new T.Mesh(new T.PlaneGeometry(15,9),new T.ShaderMaterial({
  transparent:true,depthWrite:false,uniforms:{uTime:{value:0}},
  vertexShader:`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
  fragmentShader:`varying vec2 vUv;uniform float uTime;void main(){
   vec2 dir=vUv-vec2(.97,.99);float a=atan(dir.y,dir.x);
   float ray=pow(max(0.,cos(24.*a+.12*sin(.18*uTime))),12.);
   float opacity=ray*smoothstep(.69,.05,length(dir))*smoothstep(.03,.20,vUv.y)*.094;
   gl_FragColor=vec4(.96,.71,.42,opacity*.6);
  }`
 }));
 rays.position.set(0,.08,-4.7);
 if(!economy)scene.add(rays);
 const haze=new T.Sprite(new T.SpriteMaterial({map:texture,color:0xbbceff,transparent:true,depthWrite:false,opacity:.51}));
 haze.scale.set(4.8,1.75,1);haze.position.set(0,-2.67,2.97);scene.add(haze);
 const falls:T.ShaderMaterial[]=[];
 for(const [x,z,width,len,turn] of [[-2.58,2.39,.96,3.35,-.17],[2.38,2.23,1.29,3.70,.13],[-4.38,.74,.72,2.29,-.76],[4.31,.52,.68,2.77,.74]]){
  const water=new T.ShaderMaterial({transparent:true,depthWrite:false,side:T.DoubleSide,uniforms:{uTime:{value:0},uWater:{value:waterPaint}},vertexShader:waterVertex,fragmentShader:waterFragment});
  falls.push(water);
  const f=mesh(new T.PlaneGeometry(width,len,5,12),water,x,.23-len*.5,z+.13);
  f.rotation.y=turn;
  if(!economy){
   const veil=mesh(new T.PlaneGeometry(width*.57,len*.86,4,10),water,x+width*.25,.20-len*.46,z+.24);
   veil.rotation.y=turn+.15;
  }
  const foam=new T.Sprite(new T.SpriteMaterial({map:texture,color:0xd6e7ff,transparent:true,depthWrite:false,opacity:.72}));
  foam.position.set(x,.04-len,z+.2);foam.scale.set(width*2.4,width*.92,1);island.add(foam);
  mesh(new T.CylinderGeometry(width*.59,width*.67,.062,18),m(0x3d9ece,.31,.24),x,.20,z-.18);
 }
 const jewel=new T.MeshStandardMaterial({color:0x7455d5,emissive:0x8355fd,emissiveIntensity:.53,roughness:.31,metalness:.25});
 for(const [x,y,z,q] of [[-4.6,-.45,1.3,.67],[4.38,-.55,1.45,.72],[-3.84,-1.24,1.82,.49],[3.5,-1.8,1.85,.54]]){
  const shard=mesh(new T.OctahedronGeometry(q,0),jewel,x,y,z);shard.scale.set(.62,1.45,.62);shard.rotation.z=(rand()-.5)*.7;
 }
 const spots=new T.BufferGeometry(),dots:number[]=[];
 for(let i=0;i<(economy?20:49);i++)dots.push((rand()-.5)*13,(rand()-.54)*8,(rand()-.55)*5);
 spots.setAttribute('position',new T.Float32BufferAttribute(dots,3));
 const sparkles=new T.Points(spots,new T.PointsMaterial({color:0xffd98f,size:.046,transparent:true,opacity:.78,depthWrite:false}));
 scene.add(sparkles);
 const birds=new T.InstancedMesh(new T.BufferGeometry(),new T.MeshBasicMaterial({color:0x485a85,side:T.DoubleSide}),economy?3:7);
 birds.geometry.setAttribute('position',new T.Float32BufferAttribute([-.18,.045,0,0,0,.04,-.078,.012,-.02,0,0,.04,.18,.045,0,.078,.012,-.02],3));
 birds.frustumCulled=false;scene.add(birds);
 const abort=new AbortController();
 const aiming=new T.Vector3(),cameraPos=new T.Vector3(),volumeEye=new T.Vector3();
 let frame=0,last=0,visible=true,ready=false,pointer=0,smoothed=0,painted=false,lastShadow=-1,firstFrame:number|undefined,frames=0;
 const resize=new ResizeObserver(()=>{
  const w=canvas.clientWidth,h=canvas.clientHeight;if(!w||!h)return;
  camera.aspect=w/h;
  camera.fov=T.MathUtils.radToDeg(Math.max(.48,2*Math.atan(.285/camera.aspect)));
  camera.updateProjectionMatrix();
  renderer.setPixelRatio(Math.min(devicePixelRatio||1,economy?1:heavy?1.55:1.25));renderer.setSize(w,h,false);
  last=0;
 });
 resize.observe(canvas);
 const observer=new IntersectionObserver(([entry])=>{visible=entry.isIntersecting;last=0;});
 observer.observe(canvas);
 const stage=canvas.parentElement;
 const mouse=(event:PointerEvent)=>{
  if(!reduce&&event.pointerType==='mouse'){const rect=canvas.getBoundingClientRect();pointer=(event.clientX-rect.left)/rect.width-.5;}
 };
 stage?.addEventListener('pointermove',mouse);
 const contextLost=(event:Event)=>{event.preventDefault();onError();};
 canvas.addEventListener('webglcontextlost',contextLost);
 const render=(time:number)=>{
  frame=requestAnimationFrame(render);
  if(!ready||!visible||document.hidden||(reduce&&last)||time-last<(economy?32:15))return;
  last=time;
  firstFrame??=time;
  const elapsed=reduce?0:(time-firstFrame)/1000;
  smoothed=T.MathUtils.lerp(smoothed,pointer,.062);
  island.position.y=.072*Math.sin(elapsed*.72);
  const entering=Math.exp(-elapsed*2.6);
  const angle=.27+.021*Math.sin(elapsed*.29)+smoothed*.115;
  const launch=canvas.closest('[data-launching="true"]')!==null;
  const distance=20.2+.83*entering-(launch?1.2:0);
  cameraPos.set(distance*Math.sin(angle),7.1+.13*Math.sin(elapsed*.42),distance*Math.cos(angle));
  if(!painted)camera.position.copy(cameraPos);
  else camera.position.lerp(cameraPos,.085);
  aiming.set(0,(camera.aspect<.84?1.12:1.56)+entering*.06,0);camera.lookAt(aiming);
  for(let i=0;i<birds.count;i++){
   const t=elapsed*.34+i*.42;
   helper.position.set(8.9*Math.sin(t*.45)-2,3.0+i*.18+.41*Math.sin(t*2),-5.1-i*.91);
   helper.rotation.set(0,t*.7,.18*Math.sin(t*13));helper.scale.setScalar(.94);helper.updateMatrix();birds.setMatrixAt(i,helper.matrix);
  }
  birds.instanceMatrix.needsUpdate=true;
  falls.forEach(material=>{material.uniforms.uTime.value=elapsed;});
  flagMeshes.forEach(flag=>{flag.material.uniforms.uTime.value=elapsed;});
  sparkles.position.y=.14*Math.sin(elapsed*.3);
  clouds.forEach(({cloud,x,offset})=>{cloud.position.x=x+.95*Math.sin(elapsed*.115+offset);});
  cloudVolumes.forEach(({cloud,x},index)=>{
   cloud.position.x=x+Math.sin(elapsed*.105+index)*.5;
   cloud.material.uniforms.uEye.value.copy(cloud.worldToLocal(volumeEye.copy(camera.position)));
  });
  rays.material.uniforms.uTime.value=elapsed;
  sun.intensity=3.35+.077*Math.sin(elapsed*.36);
  const shadowStep=Math.floor(elapsed*9);
  if(!economy&&shadowStep!==lastShadow){renderer.shadowMap.needsUpdate=true;lastShadow=shadowStep;}
  renderer.render(scene,camera);
  frames++;
  if(frames%20===1){
   canvas.dataset.sceneFrames=String(frames);
   canvas.dataset.sceneTime=String(time);
   canvas.dataset.sceneDraws=String(renderer.info.render.calls);
   canvas.dataset.sceneTriangles=String(renderer.info.render.triangles);
  }
  if (!painted){painted=true;onReady();}
 };
 void loadKingdomAsset(economy?'/royale/cinematic/citadel-low.glb':'/royale/cinematic/citadel.glb',abort.signal).then(asset=>{
  if(abort.signal.aborted){disposeKingdomScene(asset.scene);return;}
  asset.scene.scale.setScalar(1.19);asset.scene.position.set(0,.45,-.36);
  island.add(asset.scene);
  island.traverse(node=>{if(node instanceof T.Mesh && !(node.material instanceof T.ShaderMaterial)){node.castShadow=!economy&&!(node instanceof T.InstancedMesh);node.receiveShadow=!economy;}});
  ready=true;
 }).catch(()=>{if(!abort.signal.aborted)onError();});
 frame=requestAnimationFrame(render);
 return ()=>{abort.abort();cancelAnimationFrame(frame);resize.disconnect();observer.disconnect();
  stage?.removeEventListener('pointermove',mouse);canvas.removeEventListener('webglcontextlost',contextLost);
  disposeKingdomScene(scene);reflected?.dispose();spots.dispose();sparkles.material.dispose();clouds.forEach(({cloud})=>cloud.material.dispose());haze.material.dispose();texture.dispose();waterPaint.dispose();cloth.dispose();if(economy){rays.geometry.dispose();rays.material.dispose();}sun.shadow.dispose();renderer.renderLists.dispose();renderer.dispose();
 };
}
