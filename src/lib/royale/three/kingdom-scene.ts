import * as T from 'three';
import { disposeKingdomScene, loadKingdomAsset } from './kingdom-resources';
import type { GraphicsQuality } from '../quality';

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
  vec3 color=mix(vec3(.07,.28,.69),vec3(.61,.88,1.),clamp(ribbons*.8+glints*.21+layer.b*.24,0.,1.));
  gl_FragColor=vec4(color,fade*(.40+ribbons*.58));
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
 }`;

const rockColors = [0x2b3454,0x46466a,0x63576b,0x715b69,0x4e5975];
const leaves = [0x627244,0x395538,0x899153,0xadb566,0x476642];
export function mountKingdomScene(canvas:HTMLCanvasElement,quality:GraphicsQuality,onReady:()=>void,onError:()=>void){
 const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
 const economy=quality==='low'||(quality==='auto'&&(matchMedia('(max-width: 700px)').matches||(navigator.hardwareConcurrency||8)<6));
 const renderer=new T.WebGLRenderer({canvas,alpha:true,antialias:!economy,powerPreference:economy?'low-power':'default'});
 renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.32;
 const scene=new T.Scene(), island=new T.Group();
 renderer.shadowMap.enabled=!economy;renderer.shadowMap.type=T.PCFShadowMap;
 renderer.shadowMap.autoUpdate=false;
 const fog=new T.Fog(0x625980,18,42);scene.fog=fog;
 scene.add(island,new T.HemisphereLight(0xa9bdff,0x503450,1.68));
 const sun=new T.DirectionalLight(0xffc88d,3.1);sun.position.set(5,7,4);scene.add(sun);
 sun.castShadow=!economy;sun.shadow.mapSize.set(1024,1024);
 Object.assign(sun.shadow.camera,{left:-8,right:8,top:8,bottom:-8,near:.1,far:27});
 sun.shadow.normalBias=.035;sun.shadow.bias=-.0002;sun.shadow.radius=3.6;
 const rim=new T.DirectionalLight(0xd3afff,1.3);rim.position.set(-6,2,-5);scene.add(rim);
 const camera=new T.OrthographicCamera(-7,7,4.6,-4.6,.1,80);
 let seed=83;
 function rand(){seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;}
 const m=(color:number,metalness=0,roughness=.79)=>new T.MeshStandardMaterial({color,metalness,roughness,flatShading:true});
 const gold=m(0xc69253,.51,.36), slate=m(0x8a8796), dark=m(0x35446f), bark=m(0x735447);
 const textureLoader=new T.TextureLoader();
 const painting=(name:string)=>{
  const map=textureLoader.load('/royale/kingdom/'+name+'.webp');
  map.colorSpace=T.SRGBColorSpace;map.wrapS=map.wrapT=T.RepeatWrapping;
  map.anisotropy=economy?1:Math.min(4,renderer.capabilities.getMaxAnisotropy());
  return map;
 };
 const rockPaint=painting('rock'), grassPaint=painting('meadow'), waterPaint=painting('cascade');
 const windowGlow=new T.MeshStandardMaterial({color:0xf6b85d,emissive:0xff8c38,emissiveIntensity:1.25,roughness:.7});
 function mesh(geometry:T.BufferGeometry,material:T.Material,x:number,y:number,z:number, parent:T.Object3D=island){
  const item=new T.Mesh(geometry,material);item.position.set(x,y,z);parent.add(item);return item;
 }
 const shapes=[24,24,24,24,24];
 const radius=[1,.98,.83,.57,.12], levels=[.18,-.29,-1.15,-2.35,-3.51];
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
 const fragments=new T.InstancedMesh(rockGeometry,m(0xffffff),economy?34:65);
 const helper=new T.Object3D();
 for(let i=0;i<fragments.count;i++){
  const a=rand()*Math.PI*2;
  const r=.87+rand()*.15;
  helper.position.set(Math.cos(a)*5*r,-.63-rand()*1.15,Math.sin(a)*2.85*r);
  helper.scale.set(.24+rand()*.57,.58+rand()*1.08,.29+rand()*.47);
  helper.rotation.set(rand()*.62,rand()*6.3,rand()*.42);
  helper.updateMatrix();fragments.setMatrixAt(i,helper.matrix);
  fragments.setColorAt(i,new T.Color(rockColors[i%5]));
 }
 island.add(fragments);
 const courtyard=mesh(new T.CylinderGeometry(2.35,2.65,.35,12),slate,0,.31,-.25);
 courtyard.scale.z=.73;
 const base=mesh(new T.CylinderGeometry(2.03,2.12,.27,12),dark,0,.49,-.3);
 base.scale.z=.75;
 const paving=new T.InstancedMesh(new T.BoxGeometry(.40,.075,.28),m(0xffffff),35);
 for(let i=0;i<35;i++){
  helper.position.set((i%5-2)*.37,.28,1+Math.floor(i/5)*.25);
  helper.rotation.set(0,(rand()-.5)*.18,0);helper.scale.setScalar(1);helper.updateMatrix();
  paving.setMatrixAt(i,helper.matrix);paving.setColorAt(i,new T.Color([0x9286a1,0x8b8493,0xac9a9b][i%3]));
 }
 island.add(paving);
 const flagMeshes:T.Mesh<T.PlaneGeometry,T.ShaderMaterial>[]=[];
 function tower(x:number,z:number,height:number){
  const group=new T.Group();group.position.set(x,.35,z);island.add(group);
  const sideCount=10;
  for(let ring=0;ring<4;ring++){
   const y=.33+ring*height*.14;
   mesh(new T.CylinderGeometry(.65-y*.066,.66-y*.066,.032,sideCount),dark,0,y,0,group);
  }
  for(const d of [-1,1]){
   mesh(new T.BoxGeometry(.085,height*.68,.095),dark,d*.395,height*.42,.402,group);
  }
  const band=new T.CylinderGeometry(.57,.68,.18,8);
  mesh(new T.CylinderGeometry(.50,.67,height,sideCount),slate,0,height/2,0,group);
  mesh(band,dark,0,.12,0,group);
  mesh(band,gold,0,height-.01,0,group);
  mesh(new T.CylinderGeometry(.052,.66,.9,sideCount),dark,0,height+.55,0,group);
  mesh(new T.ConeGeometry(.053,.24,8),gold,0,height+1.12,0,group);
  const window = mesh(new T.BoxGeometry(.15,.41,.025),windowGlow,0,height*.57,.535,group);
  const arch = mesh(new T.CircleGeometry(.078,9),windowGlow,0,height*.57+.204,.553,group);arch.rotation.y=0;
  window.rotation.x=.055;
  mesh(new T.CylinderGeometry(.025,.025,.61,6),gold,0,height+1.38,0,group);
  mesh(new T.TorusGeometry(.606,.026,5,sideCount),gold,0,height+.13,0,group).rotation.x=Math.PI/2;
  for(let j=0;j<sideCount;j++){
   const a=j*Math.PI*2/sideCount;
   mesh(new T.BoxGeometry(.085,.08,.086),gold,Math.cos(a)*.59,height+.17,Math.sin(a)*.59,group);
  }
  const material=new T.ShaderMaterial({
   side:T.DoubleSide,
   uniforms:{uTime:{value:0},uTint:{value:new T.Color(x<0?0x5846b8:0x283c9d)}},
   vertexShader:`varying vec2 vUv;uniform float uTime;void main(){vUv=uv;vec3 p=position;p.z+=sin(uv.x*7.+uTime*4.)*.16*uv.x;gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);}`,
   fragmentShader:`varying vec2 vUv;uniform vec3 uTint;void main(){if(abs(vUv.y-.5)>(.5-max(0.,vUv.x-.72)*1.2))discard;float trim=step(.395,abs(vUv.y-.5));gl_FragColor=vec4(mix(uTint,vec3(.96,.61,.22),trim),1.); #include <colorspace_fragment> }`.replace(' #include <colorspace_fragment> }','\n#include <colorspace_fragment>\n}'),
  });
  const flag=new T.Mesh(new T.PlaneGeometry(.56,.25,12,4),material);flag.position.set(.29,height+1.59,0);group.add(flag);flagMeshes.push(flag);
 }
 tower(-2.19,.42,1.96);tower(2.21,.22,2.26);tower(-1.68,-1.45,1.73);tower(1.67,-1.41,1.96);
 const treeCount=economy?13:23,crowns=new T.InstancedMesh(new T.IcosahedronGeometry(1,1),m(0xffffff),treeCount*6);
 const trunks=new T.InstancedMesh(new T.CylinderGeometry(.038,.09,1,7),bark,treeCount);
 for(let i=0;i<treeCount;i++){
  const a=i/treeCount*Math.PI*2+.12, x=Math.cos(a)*(3.35+rand()*1.35), z=Math.sin(a)*(1.94+rand()*.62);
  const h=.54+rand()*.75;
  helper.position.set(x,.20+h*.41,z);helper.scale.set(h,h,h);helper.rotation.set(.13,0,(rand()-.5)*.27);helper.updateMatrix();trunks.setMatrixAt(i,helper.matrix);
  for(let j=0;j<6;j++){
   const angle=j/6*6.28;
   helper.position.set(x+Math.cos(angle)*h*.20,.33+h*(.76+rand()*.25),z+Math.sin(angle)*h*.22);
   helper.scale.set(h*(.20+rand()*.15),h*(.25+rand()*.145),h*.33);helper.rotation.set(rand(),rand()*2,rand());helper.updateMatrix();
   crowns.setMatrixAt(i*6+j,helper.matrix);crowns.setColorAt(i*6+j,new T.Color(leaves[(i+j)%5]));
  }
 }
 island.add(trunks,crowns);
 const turf=new T.InstancedMesh(new T.IcosahedronGeometry(1,0),m(0xffffff),economy?35:83);
 for(let i=0;i<turf.count;i++){
  const a=rand()*Math.PI*2,r=.58+rand()*.37;
  helper.position.set(Math.cos(a)*5.3*r,.20+rand()*.12,Math.sin(a)*2.65*r);
  helper.rotation.set(0,rand()*6.3,0);helper.scale.set(.095+rand()*.40,.04+rand()*.08,.14+rand()*.28);
  helper.updateMatrix();turf.setMatrixAt(i,helper.matrix);turf.setColorAt(i,new T.Color(leaves[i%leaves.length]));
 }
 island.add(turf);
 const puff=document.createElement('canvas');puff.width=puff.height=128;
 const ctx=puff.getContext('2d')!;
 const texture=new T.CanvasTexture(puff);texture.colorSpace=T.SRGBColorSpace;
 for (let i=0;i<10;i++){
  const x=60+(rand()-.5)*63,y=63+(rand()-.5)*43,r=22+rand()*24;
  const gradient=ctx.createRadialGradient(x,y,0,x,y,r);
  gradient.addColorStop(0,'rgba(255,242,255,.7)');gradient.addColorStop(.34,'rgba(215,197,255,.42)');gradient.addColorStop(1,'rgba(195,168,255,0)');
  ctx.fillStyle=gradient;ctx.fillRect(x-r,y-r,r*2,r*2);
 }
 const clouds=Array.from({length:economy?6:10},(_,i)=>{
  const cloud=new T.Sprite(new T.SpriteMaterial({map:texture,color:i<3?0xa2a9db:0xcbb6e7,transparent:true,depthWrite:false,opacity:i<2?.39:.53}));
  const x=(i%5-2)*3.3+(rand()-.5)*1.9;
  cloud.position.set(x,-2.4+(rand()-.5)*1.7,i<3?4.9:-4.8-rand()*3.4);
  cloud.scale.set(3.1+rand()*2.0,1.36+rand()*.61,1);scene.add(cloud);
  return {cloud,x,offset:rand()*6.28};
 });
 const rays=new T.Mesh(new T.PlaneGeometry(15,9),new T.ShaderMaterial({
  transparent:true,depthWrite:false,uniforms:{uTime:{value:0}},
  vertexShader:`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
  fragmentShader:`varying vec2 vUv;uniform float uTime;void main(){
   vec2 dir=vUv-vec2(.86,.82);float a=atan(dir.y,dir.x);
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
 for(const [x,z,width,len,turn] of [[-2.76,2.14,.87,3.25,-.15],[2.84,2.03,1.03,3.55,.15],[-4.45,.56,.62,2.58,-1.07]]){
  const water=new T.ShaderMaterial({transparent:true,depthWrite:false,side:T.DoubleSide,uniforms:{uTime:{value:0},uWater:{value:waterPaint}},vertexShader:waterVertex,fragmentShader:waterFragment});
  falls.push(water);
  const f=mesh(new T.PlaneGeometry(width,len,5,12),water,x,.23-len*.5,z+.13);
  f.rotation.y=turn;
  const foam=new T.Sprite(new T.SpriteMaterial({map:texture,color:0xd6e7ff,transparent:true,depthWrite:false,opacity:.72}));
  foam.position.set(x,.04-len,z+.2);foam.scale.set(width*2.4,width*.92,1);island.add(foam);
  mesh(new T.CylinderGeometry(width*.59,width*.67,.062,18),m(0x4a81bd,.31,.31),x,.19,z-.18);
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
 const abort=new AbortController();let frame=0, last=0, visible=true, ready=false,pointer=0, painted=false,lastShadow=-1;
 const resize=new ResizeObserver(()=>{
  const w=canvas.clientWidth,h=canvas.clientHeight;if(!w||!h)return;
  const aspect=w/h;
  const half=Math.max(4.68,6.3/aspect);
  camera.left=-half*aspect;camera.right=half*aspect;camera.top=half;camera.bottom=-half;
  camera.updateProjectionMatrix();renderer.setPixelRatio(Math.min(devicePixelRatio||1,economy?1:1.45));renderer.setSize(w,h,false);
  last=0;
 });
 resize.observe(canvas);
 const observer=new IntersectionObserver(([entry])=>{visible=entry.isIntersecting;last=0;});
 observer.observe(canvas);
 const mouse=(event:PointerEvent)=>{
  if(!reduce&&event.pointerType==='mouse'){const rect=canvas.getBoundingClientRect();pointer=(event.clientX-rect.left)/rect.width-.5;}
 };
 canvas.addEventListener('pointermove',mouse);
 const contextLost=(event:Event)=>{event.preventDefault();onError();};
 canvas.addEventListener('webglcontextlost',contextLost);
 const started=performance.now();
 const render=(time:number)=>{
  frame=requestAnimationFrame(render);
  if(!ready||!visible||document.hidden||(reduce&&last)||time-last<(economy?32:15))return;
  last=time;
  const elapsed=reduce?0:(time-started)/1000;
  island.position.y=.12*Math.sin(elapsed*.72);
  island.rotation.y=-.11+.05*Math.sin(elapsed*.32)+pointer*.23;
  const angle=.27;
  camera.position.set(13*Math.sin(angle),5.35,13*Math.cos(angle));camera.lookAt(0,.72,0);
  falls.forEach(material=>{material.uniforms.uTime.value=elapsed;});
  flagMeshes.forEach(flag=>{flag.material.uniforms.uTime.value=elapsed;});
  sparkles.position.y=.14*Math.sin(elapsed*.3);
  clouds.forEach(({cloud,x,offset})=>{cloud.position.x=x+.95*Math.sin(elapsed*.115+offset);});
  rays.material.uniforms.uTime.value=elapsed;
  sun.intensity=3.1+.23*Math.sin(elapsed*.9);
  const shadowStep=Math.floor(elapsed*16);
  if(!economy&&shadowStep!==lastShadow){renderer.shadowMap.needsUpdate=true;lastShadow=shadowStep;}
  renderer.render(scene,camera);
  if (!painted){painted=true;onReady();}
 };
 void loadKingdomAsset('/royale/kingdom/citadel.glb',abort.signal).then(asset=>{
  if(abort.signal.aborted){disposeKingdomScene(asset.scene);return;}
  asset.scene.scale.setScalar(1.19);asset.scene.position.set(0,.49,-.42);
  island.add(asset.scene);
  island.traverse(node=>{if(node instanceof T.Mesh && !(node.material instanceof T.ShaderMaterial)){node.castShadow=!economy;node.receiveShadow=!economy;}});
  ready=true;
 }).catch(()=>{if(!abort.signal.aborted)onError();});
 frame=requestAnimationFrame(render);
 return ()=>{abort.abort();cancelAnimationFrame(frame);resize.disconnect();observer.disconnect();
  canvas.removeEventListener('pointermove',mouse);canvas.removeEventListener('webglcontextlost',contextLost);
  disposeKingdomScene(scene);spots.dispose();sparkles.material.dispose();clouds.forEach(({cloud})=>cloud.material.dispose());haze.material.dispose();texture.dispose();waterPaint.dispose();if(economy){rays.geometry.dispose();rays.material.dispose();}sun.shadow.dispose();renderer.dispose();
 };
}
