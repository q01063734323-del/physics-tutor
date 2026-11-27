import * as T from 'three';
import {loadKingdomAsset,disposeKingdomScene} from './kingdom-resources';
import { leagues } from '../leagues';
import type { KingdomQuality } from '../quality';

const positions=[
 [-10.7,-1.9,3.2],[-6.8,-.18,-3.0],[-2.5,.05,1.2],
 [2.05,.94,-4.1],[6.3,1.17,.7],[10.95,2.12,-3.8],
];
export function mountLeagueWorld(canvas:HTMLCanvasElement,current:number,quality:KingdomQuality,
 project:(index:number,x:number,y:number,visible:boolean)=>void){
 const renderer=new T.WebGLRenderer({canvas,alpha:true,antialias:quality!=='low'});
 renderer.setClearColor(0,0);renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.12;
 const scene=new T.Scene(), camera=new T.OrthographicCamera(-12,12,6,-6,.1,90);
 scene.fog=new T.Fog(0x7188b6,23,62);
 scene.add(new T.HemisphereLight(0xbcd8ff,0x585271,1.55));
 const sun=new T.DirectionalLight(0xffdeb1,2.95);sun.position.set(-9,15,8);scene.add(sun);
 const hoop=new T.TorusGeometry(1,.035,6,48);
 const anchors:T.Vector3[]=[],moving:T.Object3D[]=[];
 const extraMaterials:T.Material[]=[],extraGeometry:T.BufferGeometry[]=[hoop];
 const controller=new AbortController();
 const islands:T.Group[]=[];
 const baseModels:(T.Group|undefined)[]=Array(leagues.length);
 const low=quality==='low', detailed=quality==='ultra'||quality==='high'||(quality==='auto'&&innerWidth>=920);
 const asset=(index:number,detail:boolean)=>`/royale/league-v2/island-${index}${detail?'':'-low'}.glb`;
 let highModel:T.Group|undefined,highIndex=-1,highRequest:AbortController|undefined,requestedIndex=-1;
 let selectedIndex=current;
 canvas.dataset.models='0';
 async function loadOverview(){
  const order=[current,...leagues.map((_,index)=>index).filter(index=>index!==current)];
  for(const index of order){
   if(controller.signal.aborted)return;
   try{
    const {scene:model}=await loadKingdomAsset(asset(index,false),controller.signal);
    if(controller.signal.aborted){disposeKingdomScene(model);return;}
    baseModels[index]=model;islands[index].add(model);model.visible=index!==highIndex;
    canvas.dataset.models=String(baseModels.filter(Boolean).length);dirty=true;
   }catch{if(!controller.signal.aborted)canvas.dataset.modelError='true';}
  }
 }
 function updateDetail(){
  const next=detailed&&zoom>1.02?selectedIndex:-1;
  if(next===requestedIndex)return;
  requestedIndex=next;
  highRequest?.abort();
  if(highModel){
   islands[highIndex].remove(highModel);disposeKingdomScene(highModel);
   const base=baseModels[highIndex];if(base)base.visible=true;
   highModel=undefined;highIndex=-1;delete canvas.dataset.detail;
  }
  if(next<0)return;
  const request=new AbortController();highRequest=request;
  void loadKingdomAsset(asset(next,true),request.signal).then(({scene:model})=>{
   if(request.signal.aborted||controller.signal.aborted){disposeKingdomScene(model);return;}
   islands[next].add(model);const base=baseModels[next];if(base)base.visible=false;
   highModel=model;highIndex=next;canvas.dataset.detail=String(next);dirty=true;
  }).catch(()=>{if(!request.signal.aborted)canvas.dataset.modelError='true';});
 }
 // Bounded atmosphere shared by all six islands. Each sprite plane uses the same shader.
 const hazeGeometry=new T.PlaneGeometry(1,1);
 const haze=new T.ShaderMaterial({
  transparent:true,depthWrite:false,
  uniforms:{clock:{value:0}},
  vertexShader:'varying vec2 p; void main(){p=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
  fragmentShader:`varying vec2 p; uniform float clock;
   void main(){
    vec2 q=p-.5;
    float edge=1.-smoothstep(.14,.49,length(q));
    float drift=.64+.36*sin(q.x*17.+sin(q.y*12.)*1.5+clock*.18);
    gl_FragColor=vec4(.59,.68,.84,edge*drift*.31);
   }`,
 });
 extraGeometry.push(hazeGeometry);extraMaterials.push(haze);
 const cloudCount=low?2:detailed?8:4;
 for(let i=0;i<cloudCount;i++){
  const cloud=new T.Mesh(hazeGeometry,haze);
  cloud.position.set(-14+i*28/Math.max(1,cloudCount-1),-3.7+(i%3)*1.32,-8-(i%2)*6);
  cloud.scale.set(8+i%3*2,2.1+i%2,1);
  scene.add(cloud);
 }
 const ridgeGeometry=new T.DodecahedronGeometry(1);
 const ridgeMaterial=new T.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:.28,depthWrite:false});
 const ridges=new T.InstancedMesh(ridgeGeometry,ridgeMaterial,low?5:11);
 const ridgePose=new T.Object3D(),ridgeTint=new T.Color();
 for(let i=0;i<ridges.count;i++){
  const satellite=i%3===0;
  ridgePose.position.set(-17+i*34/(ridges.count-1),satellite?-3.2+i%4*.46:-8.3+i%4*.67,-13-i%4*1.7);
  ridgePose.scale.set(satellite?.60+i%2*.42:1.47,satellite?.52:1.68+i%3*.54,satellite?.60:1.35);
  ridgePose.rotation.set(.3,i*.95,.21*Math.sin(i));
  ridgePose.updateMatrix();ridges.setMatrixAt(i,ridgePose.matrix);
  ridges.setColorAt(i,ridgeTint.setHex(satellite?0x687b9b:0x67728e));
 }
 scene.add(ridges);extraGeometry.push(ridgeGeometry);extraMaterials.push(ridgeMaterial);
 const addDecoration=(geo:T.BufferGeometry, tint:number, opacity:number)=>{
  const mat=new T.MeshBasicMaterial({color:tint,transparent:true,opacity,depthWrite:false,toneMapped:false});
  extraMaterials.push(mat);
  const mesh=new T.Mesh(geo,mat);scene.add(mesh);return mesh;
 };
 for(const index of leagues.keys()){
  const [x,y,z]=positions[index];
  const island=new T.Group();island.position.set(x,y,z);
  island.scale.setScalar(index===current?1.10:.98);
  island.rotation.y=-.13+index*.04;
  islands.push(island);scene.add(island);
  const waterfall=new T.PlaneGeometry(index===1?.52:.34,detailed?3.25:2.48);
  extraGeometry.push(waterfall);
  const water: T.Mesh = addDecoration(waterfall,0x7de5ff,.59);
  const flow=new T.ShaderMaterial({
   transparent:true,depthWrite:false,
   uniforms:{clock:{value:0},tint:{value:new T.Color([0x8be1cd,0x68cfff,0xa8dcff,0xb7c9e4,0xb4a6ff,0xc4dafe][index])}},
   vertexShader:'varying vec2 uvv; void main(){uvv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
   fragmentShader:`varying vec2 uvv;uniform float clock;uniform vec3 tint;
    void main(){float core=sin(3.14159*uvv.x);float stream=.63+.24*sin(36.*uvv.x+13.*uvv.y+clock*7.);
    float tail=smoothstep(0.,.34,uvv.y);gl_FragColor=vec4(tint,core*stream*tail*.92);}`
  });
  extraMaterials.push(flow);water.material=flow;moving.push(water);
  water.position.set(x+1.19,y-1.47,z+1.87);water.rotation.z=.10;
  if(!low){const glint=addDecoration(waterfall,0xc0f2ff,.27);glint.position.copy(water.position);glint.position.z+=.025;glint.scale.set(.35,.87,1);moving.push(glint);}
  if(index===current){
   const loop=addDecoration(hoop,index===current?0xffd37a:0xe2b371,.70);
   loop.position.set(x,y+(index===current?.2:1.62),z);loop.scale.setScalar(2.58);
   loop.rotation.x=index===current?Math.PI/2:.46;
  }
  anchors.push(new T.Vector3(x,y+.10,z+2.02));
 }
 for(let index=0;index<anchors.length-1;index++){
  const a=anchors[index].clone(),b=anchors[index+1].clone();
  a.y-=.21;b.y-=.21;
  const route=new T.CubicBezierCurve3(a,a.clone().add(new T.Vector3(1.68,-.89,1.38)),b.clone().add(new T.Vector3(-1.74,-.37,1.17)),b);
  const lit=index<current;
  const trail=new T.TubeGeometry(route,42,lit?.056:.034,6,false);
  extraGeometry.push(trail);addDecoration(trail,lit?0xffd479:0xa5c5e8,lit?.95:.67);
  if(lit){const glow=new T.TubeGeometry(route,36,.135,5,false);extraGeometry.push(glow);addDecoration(glow,0xffbc55,.16);}
 }
 const sealGeo=new T.SphereGeometry(.12,10,6);extraGeometry.push(sealGeo);
 anchors.forEach((anchor,index)=>{
  const seal=addDecoration(sealGeo,index<=current?0xffdc83:0xa5badb,index<=current?.94:.55);
  seal.position.copy(anchor);seal.position.y-=.21;
  if(index===current){seal.scale.setScalar(1.85);const rim=addDecoration(hoop,0xffd89a,.6);rim.position.copy(seal.position);rim.scale.setScalar(.34);rim.rotation.x=Math.PI/2;}
 });
 const motion=matchMedia('(prefers-reduced-motion: reduce)');
 const observer=new ResizeObserver(()=>{resize();dirty=true;});
 observer.observe(canvas);
 let width=1,height=1,span=14,zoom=1,viewZoom=1,target=anchors[current].clone(),center=target.clone();
 let dirty=true,frame=0,stamp=0,measureStart=0,frames=0,visible=true;
 const intersection=new IntersectionObserver(([entry])=>{visible=entry.isIntersecting;measureStart=0;frames=0;dirty=true;});
 intersection.observe(canvas);
 const offset=new T.Vector3(.6,9.5,25), pointer=new T.Vector3();
 function resize(){
  width=Math.max(canvas.clientWidth,1);height=Math.max(canvas.clientHeight,1);
  span=width<620?8.65:29.8;
  renderer.setPixelRatio(Math.min(devicePixelRatio,low?1:quality==='ultra'?1.75:1.45));renderer.setSize(width,height,false);
 }
 function draw(time:number){
  frame=requestAnimationFrame(draw);
  if(!visible||document.hidden||time-stamp<(low?31:14))return;
  const reduced=motion.matches;
  if(reduced&&!dirty)return;
  stamp=time;
  center.lerp(target,reduced?1:.14);viewZoom=T.MathUtils.lerp(viewZoom,zoom,reduced?1:.14);
  const half=span/(2*viewZoom), tall=half*height/width;
  Object.assign(camera,{left:-half,right:half,top:tall,bottom:-tall});
  camera.position.copy(center).add(offset);camera.lookAt(center);camera.updateProjectionMatrix();camera.updateMatrixWorld();
  haze.uniforms.clock.value=reduced?0:time*.001;
  if(!reduced)moving.forEach((mesh,index)=>{
   if((mesh as T.Mesh).material instanceof T.ShaderMaterial)((mesh as T.Mesh).material as T.ShaderMaterial).uniforms.clock.value=time*.001;
   else if((mesh as T.Mesh).geometry===hoop)mesh.rotation.y=time*.00024+index;
   else mesh.scale.y=.81+Math.sin(time*.003+index)*.12;
  });
  renderer.render(scene,camera);dirty=false;
  anchors.forEach((anchor,index)=>{
   pointer.copy(anchor).project(camera);
   project(index,(pointer.x+1)*width/2,(1-pointer.y)*height/2,Math.abs(pointer.x)<.92&&Math.abs(pointer.y)<.91);
  });
  measureStart||=time;frames++;
  if(time-measureStart>=1000){
   canvas.dataset.fps=String(Math.round(frames*1000/(time-measureStart)));
   canvas.dataset.geometries=String(renderer.info.memory.geometries);
   canvas.dataset.draws=String(renderer.info.render.calls);
   measureStart=time;frames=0;
  }
 }
 const motionChange=()=>{dirty=true;};motion.addEventListener('change',motionChange);
 resize();frame=requestAnimationFrame(draw);void loadOverview();
 return {
  focus(index:number,reset=false){
   if(reset)zoom=1;
   selectedIndex=index;target.copy(anchors[index]);target.y+=.96;target.z=0;
   if(width>=920&&Math.abs(zoom-1)<.001&&index===current){target.x=0;target.y=.75;}
   updateDetail();dirty=true;
  },
  zoom(factor:number,index:number){
   const previous=zoom;zoom=T.MathUtils.clamp(zoom*factor,.72,1.8);
   if(previous<=1&&zoom>1&&width>=920){target.copy(anchors[index]);target.y+=.96;target.z=0;}
   updateDetail();dirty=true;
  },
  pan(dx:number,dy:number){
   target.x=T.MathUtils.clamp(target.x-dx*span/width/zoom,-13,13);
   target.y=T.MathUtils.clamp(target.y+dy*span/width/zoom,-3,6);
   dirty=true;
  },
  dispose(){
   controller.abort();highRequest?.abort();islands.forEach(island=>disposeKingdomScene(island));cancelAnimationFrame(frame);observer.disconnect();intersection.disconnect();motion.removeEventListener('change',motionChange);
   scene.traverse(node=>{if(node instanceof T.InstancedMesh)node.dispose();});
   extraGeometry.forEach(geo=>geo.dispose());
   extraMaterials.forEach(mat=>mat.dispose());renderer.dispose();renderer.forceContextLoss();
  },
 };
}
