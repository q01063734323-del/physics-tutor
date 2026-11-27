import * as T from 'three';
import { leagues } from '../leagues';
import type { KingdomQuality } from '../quality';

const heights=[-2.1,-1.1,-.45,.15,.78,1.8];
const stone=[0x9c8878,0x8197ae,0xba9f7b,0x987666,0x86729b,0xd4b58a];
const roofs=[0x234b92,0x447690,0x267b9a,0x83522e,0x6e369f,0xd3a64a];

export function mountLeagueWorld(canvas:HTMLCanvasElement,current:number,quality:KingdomQuality,
 project:(index:number,x:number,y:number,visible:boolean)=>void){
 const renderer=new T.WebGLRenderer({canvas,alpha:true,antialias:quality!=='low'});
 renderer.setClearColor(0,0);renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.17;
 const scene=new T.Scene(), camera=new T.OrthographicCamera(-12,12,6,-6,.1,90);
 scene.add(new T.HemisphereLight(0xc4dcff,0x51406a,2.1));
 const sun=new T.DirectionalLight(0xffdc9e,3.2);sun.position.set(-9,15,8);scene.add(sun);
 const shapes={
  cube:new T.BoxGeometry(1,1,1),
  rock:new T.DodecahedronGeometry(1,0),
  tower:new T.CylinderGeometry(.88,1,1,10),
  cone:new T.ConeGeometry(1,1,10),
  orb:new T.SphereGeometry(1,16,10),
  hoop:new T.TorusGeometry(1,.043,6,40),
  crystal:new T.OctahedronGeometry(1),
 };
 const grain=document.createElement('canvas');grain.width=grain.height=128;
 const brush=grain.getContext('2d')!;
 brush.fillStyle='#ece9e6';brush.fillRect(0,0,128,128);
 for(let i=0;i<1700;i++){
  brush.fillStyle=i%3?'#96897928':'#fff9df68';
  brush.fillRect((i*139.31)%128,(i*91.73)%128,.55+i%4,.6+i%3);
 }
 const surface=new T.CanvasTexture(grain);surface.colorSpace=T.SRGBColorSpace;surface.anisotropy=4;
 const material=new T.MeshStandardMaterial({roughness:.86,map:lowTexture()});
 function lowTexture(){return quality==='low'?null:surface;}
 type Part={shape:keyof typeof shapes;color:number;matrix:T.Matrix4};
 const pose=new T.Object3D(), color=new T.Color();
 const anchors:T.Vector3[]=[], moving:T.Object3D[]=[];
 const extraMaterials:T.Material[]=[], extraGeometry:T.BufferGeometry[]=[];
 const low=quality==='low', detailed=quality==='ultra'||quality==='high';
 const addDecoration=(geo:T.BufferGeometry, tint:number, opacity:number)=>{
  const mat=new T.MeshBasicMaterial({color:tint,transparent:true,opacity,depthWrite:false,toneMapped:false});
  extraMaterials.push(mat);
  const mesh=new T.Mesh(geo,mat);scene.add(mesh);return mesh;
 };
 for(const [index,league] of leagues.entries()){
  const x=(index-2.5)*4.42,y=heights[index],z=index%2===0?.12:-.65;
  const parts:Part[]=[];
  const add=(shape:Part['shape'],tint:number,dx:number,dy:number,dz:number,sx:number,sy:number,sz:number,spin=0,tilt=0)=>{
   pose.position.set(x+dx,y+dy,z+dz);pose.scale.set(sx,sy,sz);pose.rotation.set(0,spin,tilt);pose.updateMatrix();
   parts.push({shape,color:tint,matrix:pose.matrix.clone()});
  };
  const radius=index===current?1.13:1;
  add('rock',0x625872,0,-.94,0,1.85*radius,1.78,1.37,.34,.23);
  add('rock',0x494b64,.11,-1.65,-.14,1.09,1.54,.87,.4,-.22);
  add('tower',0x426852,0,-.16,0,1.86*radius,.52,1.41,.27);
  for(let i=0;i<(low?8:20);i++){
   const angle=i*2.39996,r=1.37+(i%4)*.10;
   add('rock',i%3===0?0x627755:0x746a76,Math.cos(angle)*r,-.39-(i%3)*.13,Math.sin(angle)*r*.74,.34,.46+(i%5)*.10,.39,angle,Math.sin(i)*.5);
   if(i%3===0){add('tower',0x4c392b,Math.cos(angle)*r,.18,Math.sin(angle)*r*.74,.075,.45,.075);add('rock',i%2?0x597f53:0x385e61,Math.cos(angle)*r,.44,Math.sin(angle)*r*.74,.28,.42,.28,angle);}
  }
  const wall=stone[index],roof=roofs[index], gold=0xe4b664;
  function keep(dx:number,dz:number,r:number,h:number,cap:'spire'|'dome'|'battlement'){
   add('tower',wall,dx,h/2,dz,r,h,r);
   add('tower',gold,dx,h*.86,dz,r*1.02,.072,r*1.02);
   add('tower',wall,dx,.14,dz,r*1.08,.27,r*1.08);
   if(cap==='spire')add('cone',roof,dx,h+.35,dz,r*1.12,.77,r*1.12);
   if(cap==='dome')add('orb',roof,dx,h-.012,dz,r*.96,.59,r*.96);
   if(cap==='battlement'){
    add('tower',wall,dx,h,dz,r*1.1,.18,r*1.1);
    for(let i=0;i<8;i++){const a=i*Math.PI/4;add('cube',wall,dx+Math.sin(a)*r*.84,h+.14,dz+Math.cos(a)*r*.84,.17,.23,.17,a);}
   }
   for(let i=-1;i<=1;i++){
    const a=i*.61;
    add('cube',0x342b47,dx+Math.sin(a)*r*.93,h*.57,dz+Math.cos(a)*r*.93,.11,.31,.042,a);
    add('cube',0xf2bf7b,dx+Math.sin(a)*r*.95,h*.58,dz+Math.cos(a)*r*.95,.047,.21,.045,a);
   }
   if(detailed)for(let row=1;row<5;row++)for(let i=0;i<5;i++){
    const a=(i-2)*.44+.15*(row%2);
    add('cube',row%2?wall:0x927e75,dx+Math.sin(a)*r*.97,row*h/6,dz+Math.cos(a)*r*.97,.23,.067,.047,a);
   }
  }
  if(index===0||index===1){
   add('cube',wall,0,.66,0,1.86,1.3,1.13);
   keep(-.9,.32,.38,1.34,'battlement');keep(.89,.32,.38,1.39,index?'spire':'battlement');
   keep(index===0?-.19:.31,-.59,.55,index===0?1.92:2.2,index?'spire':'battlement');
   add('cube',roof,-.20,2.18,-.20,.43,.26,.04);
   if(index===1)for(let i=0;i<5;i++)add('cube',wall,1.18+i*.13,.21+i*.04,-.19,.21,.15,.64);
  }else if(index===2){
   keep(0,.07,.87,1.36,'dome');keep(-.96,-.37,.28,1.1,'dome');
   add('tower',gold,.26,1.98,.12,.115,.92,.115,0,-.63);
   add('tower',0x2c4d6b,.47,2.31,.13,.18,.30,.18,0,-.63);
  }else if(index===3){
   add('cube',wall,0,.82,0,1.62,1.52,1.09);
   keep(.71,-.47,.43,2.22,'battlement');keep(-.88,.22,.31,1.22,'spire');
   add('orb',0x492c35,0,1.41,.58,.39,.39,.052);
   add('hoop',gold,0,1.41,.64,.34,.34,.34);
   add('cube',gold,0,1.51,.66,.04,.23,.04,0,.39);
  }else if(index===4){
   keep(0,0,.73,1.62,'spire');
   for(let i=0;i<5;i++){const a=i*1.26;add('crystal',i%2?0x72caf3:0xc17aff,Math.cos(a)*1.19,.72+i%3*.16,Math.sin(a)*.91,.29,.76,.29,a,.26);}
  }else{
   keep(0,-.25,.62,2.25,'dome');
   for(const dx of [-1.09,-.51,.51,1.09])keep(dx,Math.abs(dx)<1?.33:-.34,.27,Math.abs(dx)<1?1.57:1.92,'spire');
   add('cube',wall,0,.52,.14,2.08,1.04,1.11);
  }
  for(let i=0;i<6;i++)add('cube',wall,0,.05+i*.041,.98-i*.08,.82,.105,.19);
  if(index===1||index===4)for(let i=0;i<3;i++)add('crystal',index===1?0x65bfff:0xb178ed,1.25+i*.17,.25+i*.1,.52-i*.16,.13,.32,.13,i,.3);
  for(const key of Object.keys(shapes) as Part['shape'][]){
   const rows=parts.filter(part=>part.shape===key);if(!rows.length)continue;
   const batch=new T.InstancedMesh(shapes[key],material,rows.length);
   rows.forEach(({color:tint,matrix},i)=>{batch.setMatrixAt(i,matrix);batch.setColorAt(i,color.setHex(tint).multiplyScalar(index>current?.84:1));});
   scene.add(batch);
  }
  const waterfall=new T.PlaneGeometry(.24,detailed?2.8:2.12);
  extraGeometry.push(waterfall);
  const water: T.Mesh = addDecoration(waterfall,0x7de5ff,.59);
  const flow=new T.ShaderMaterial({
   transparent:true,depthWrite:false,
   uniforms:{clock:{value:0}},
   vertexShader:'varying vec2 uvv; void main(){uvv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
   fragmentShader:`varying vec2 uvv;uniform float clock;
    void main(){float core=sin(3.14159*uvv.x);float stream=.63+.24*sin(36.*uvv.x+13.*uvv.y+clock*7.);
    float tail=smoothstep(0.,.34,uvv.y);gl_FragColor=vec4(.45,.82,1.,core*stream*tail*.74);}`
  });
  extraMaterials.push(flow);water.material=flow;moving.push(water);
  water.position.set(x+.83,y-1.11,z+1.10);water.rotation.z=.10;
  if(!low){const glint=addDecoration(waterfall,0xc0f2ff,.27);glint.position.copy(water.position);glint.position.z+=.025;glint.scale.set(.35,.87,1);moving.push(glint);}
  if(index===2||index===5||index===current){
   const loop=addDecoration(shapes.hoop,index===current?0xffd37a:0xe2b371,.70);
   loop.position.set(x,y+(index===current?.2:1.62),z);loop.scale.setScalar(index===current?1.93:1.10);
   loop.rotation.x=index===current?Math.PI/2:.46;
   if(index!==current)moving.push(loop);
  }
  anchors.push(new T.Vector3(x,y+.18,z+1.45));
 }
 for(let index=0;index<anchors.length-1;index++){
  const a=anchors[index].clone(),b=anchors[index+1].clone();
  const route=new T.CubicBezierCurve3(a,a.clone().add(new T.Vector3(2,-.54,.65)),b.clone().add(new T.Vector3(-2,.26,.72)),b);
  const lit=index<current;
  const trail=new T.TubeGeometry(route,32,lit?.036:.025,5,false);
  extraGeometry.push(trail);addDecoration(trail,lit?0xffd479:0xa5c5e8,lit?.96:.56);
  if(lit){const glow=new T.TubeGeometry(route,26,.11,5,false);extraGeometry.push(glow);addDecoration(glow,0xffbc55,.16);}
 }
 const motion=matchMedia('(prefers-reduced-motion: reduce)');
 const observer=new ResizeObserver(()=>{resize();dirty=true;});
 observer.observe(canvas);
 let width=1,height=1,span=14,zoom=1,viewZoom=1,target=anchors[current].clone(),center=target.clone();
 let dirty=true,frame=0,stamp=0,measureStart=0,frames=0,visible=true;
 const intersection=new IntersectionObserver(([entry])=>{visible=entry.isIntersecting;measureStart=0;frames=0;dirty=true;});
 intersection.observe(canvas);
 const offset=new T.Vector3(0,7.5,25), pointer=new T.Vector3();
 function resize(){
  width=Math.max(canvas.clientWidth,1);height=Math.max(canvas.clientHeight,1);
  span=width<620?8.2:29.4;
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
  if(!reduced)moving.forEach((mesh,index)=>{
   if((mesh as T.Mesh).material instanceof T.ShaderMaterial)((mesh as T.Mesh).material as T.ShaderMaterial).uniforms.clock.value=time*.001;
   else if((mesh as T.Mesh).geometry===shapes.hoop)mesh.rotation.y=time*.00024+index;
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
 resize();frame=requestAnimationFrame(draw);
 return {
  focus(index:number){
   target.copy(anchors[index]);target.y+=.68;target.z=0;
   if(width>=920&&zoom===1&&index===current){target.x=0;target.y=.47;}
   dirty=true;
  },
  zoom(factor:number,index:number){
   const previous=zoom;zoom=T.MathUtils.clamp(zoom*factor,.63,1.8);
   if(previous<=1&&zoom>1&&width>=920){target.copy(anchors[index]);target.y+=.65;target.z=0;}
   dirty=true;
  },
  pan(dx:number,dy:number){
   target.x=T.MathUtils.clamp(target.x-dx*span/width/zoom,-13,13);
   target.y=T.MathUtils.clamp(target.y+dy*span/width/zoom,-3,6);
   dirty=true;
  },
  dispose(){
   cancelAnimationFrame(frame);observer.disconnect();intersection.disconnect();motion.removeEventListener('change',motionChange);
   scene.traverse(node=>{if(node instanceof T.InstancedMesh)node.dispose();});
   Object.values(shapes).forEach(geo=>geo.dispose());extraGeometry.forEach(geo=>geo.dispose());
   surface.dispose();material.dispose();extraMaterials.forEach(mat=>mat.dispose());renderer.dispose();renderer.forceContextLoss();
  },
 };
}
