import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {MeshoptDecoder} from 'three/addons/libs/meshopt_decoder.module.js';
import {ribbonVertex,ribbonFragment,radialVertex,radialFragment} from './comet-shaders.mjs';

const settings={
 high:{ribbons:[7,8,7],strips:17,steps:11,embers:84,debris:12},
 medium:{ribbons:[5,6,5],strips:14,steps:7,embers:54,debris:8},
 low:{ribbons:[3,4,3],strips:10,steps:5,embers:26,debris:5},
};
const TAU=Math.PI*2;
const unitZ=new T.Vector3(0,0,1);
const clamp=(x)=>Math.max(0,Math.min(1,x));
const smooth=(a,b,x)=>{const p=clamp((x-a)/(b-a));return p*p*(3-2*p);};
const blend=T.MathUtils.lerp;
function ribbons(count, steps, across, layer){
 const cp=[],uv=[],a=[],indices=[];
 const lens=[3.63,3.42,2.65], widths=[.66,.53,.33];
 const radial=[.36,.79,1.31];
 for(let n=0;n<count;n++){
  const angle=TAU*n/count+radial[layer];
  const width=widths[layer]*(.89+.21*Math.sin(n*2.7+.6));
  const length=lens[layer]*(.91+.18*Math.sin(n*6.26+layer*2.75)+.14*Math.cos(n*2.23));
  const curl=(n%3===0?-1.43:1.64)*(1.28+.42*Math.cos(n*1.6));
  const start=uv.length/2;
  for(let j=0;j<=steps;j++)for(let i=0;i<=across;i++){
   cp.push(0,0,0);uv.push(i/across,j/steps);a.push(angle,width,length,curl);
   if(i&&j){
    const z=start+j*(across+1)+i;
    indices.push(z-across-2,z-across-1,z,z-across-2,z,z-1);
   }
  }
 }
 const g=new T.BufferGeometry();
 g.setIndex(indices);
 g.setAttribute('position',new T.Float32BufferAttribute(cp,3));
 g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));
 g.setAttribute('shape',new T.Float32BufferAttribute(a,4));
 return g;
}
const ribbonUniforms=(atlas,heat)=>({atlas:{value:atlas},time:{value:0},heat:{value:heat},fade:{value:0},progress:{value:0},burst:{value:0}});
function mark(geom,mode){
 const material=new T.ShaderMaterial({
  vertexShader:radialVertex,fragmentShader:radialFragment,transparent:true,depthWrite:false,
  blending:T.AdditiveBlending,side:T.DoubleSide,uniforms:{time:{value:0},fade:{value:0},width:{value:.026},mode:{value:mode}},
 });
 const m=new T.Mesh(geom,material);m.rotation.x=-Math.PI/2;m.renderOrder=4;return m;
}
function shardGeometry(){
 const vertices=[-.79,-.4,-.36, .45,-.51,-.45, .79,-.08,.13, .25,.78,-.04, -.41,.43,.51, -.37,-.19,.94];
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(vertices,3));
 g.setIndex([0,2,1,0,3,2,0,4,3,0,5,4,0,1,5,1,2,5,2,3,5,3,4,5]);
 g.computeVertexNormals();return g.toNonIndexed();
}

/**
 * Owns a preallocated pool. Spawn times are in seconds.
 * @param {T.Scene} scene
 * @param {{baseURL: URL, quality?: 'low' | 'medium' | 'high', capacity?: number}} options
 */
export async function createCometFlame(scene,{baseURL,quality='high',capacity=4}){
 if(!(quality in settings)||!Number.isInteger(capacity)||capacity<1||capacity>16) throw Error('Invalid quality or capacity');
 const palette=settings[quality], loader=new T.TextureLoader();
 const gltfLoader=new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
 const [gltf,...atlases]=await Promise.all([
  gltfLoader.loadAsync(new URL('fireball.glb',baseURL).href),
  ...['outer','mid','hot'].map(k=>loader.loadAsync(new URL('textures/flame-'+k+'.png',baseURL).href)),
 ]);
 for(const t of atlases){t.colorSpace=T.SRGBColorSpace;t.anisotropy=1;}
 const geometries=palette.ribbons.map((n,i)=>ribbons(n,palette.strips,palette.steps,i));
 const burst=ribbons(quality==='low'?6:11,13,5,2);
 const petalPlane=new T.PlaneGeometry(2,2);
 const debrisGeometry=shardGeometry(), emberGeometry=shardGeometry();
 const cinder=new T.MeshStandardMaterial({color:0x51313e,roughness:.85,flatShading:true,emissive:0x541404,emissiveIntensity:.38});
 const ember=new T.MeshBasicMaterial({color:0xffffff,transparent:false});
 const temp=new T.Object3D(), delta=new T.Vector3(), dummyColor=new T.Color();
 const local=new T.Vector3(), tangent=new T.Vector3();
 const pool=[];
 let disposed=false;
 for(let i=0;i<capacity;i++){
  const group=new T.Group();scene.add(group);group.visible=false;
  const carrier=new T.Group();group.add(carrier);
  const core=gltf.scene.clone(true);carrier.add(core);
  const flame=geometries.map((g,l)=>{
   const m=new T.Mesh(g,new T.ShaderMaterial({
    uniforms:ribbonUniforms(atlases[l],[1.66,2.68,4.10][l]),vertexShader:ribbonVertex,fragmentShader:ribbonFragment,
    transparent:true,depthWrite:false,side:T.DoubleSide,
   }));
   m.renderOrder=l+1;m.frustumCulled=false;carrier.add(m);return m;
  });
  const footprint=mark(petalPlane,0),hotspot=mark(petalPlane,1);group.add(footprint,hotspot);
  const plume=new T.Mesh(burst,new T.ShaderMaterial({
   uniforms:ribbonUniforms(atlases[1],3.1),vertexShader:ribbonVertex,fragmentShader:ribbonFragment,side:T.DoubleSide,
   transparent:true,depthWrite:false,blending:T.AdditiveBlending,
  }));
  plume.material.uniforms.burst.value=1;plume.renderOrder=6;plume.frustumCulled=false;group.add(plume);
  const fragments=new T.InstancedMesh(debrisGeometry,cinder,palette.debris);
  const sparks=new T.InstancedMesh(emberGeometry,ember,palette.embers);
  fragments.frustumCulled=sparks.frustumCulled=false;group.add(fragments,sparks);
  for(let n=0;n<palette.embers;n++) {
   dummyColor.set(n%6===0?0xe24616:n%4===0?0xff7525:0xffc349).multiplyScalar(n%5===0?2.5:1.5);
   sparks.setColorAt(n,dummyColor);
  }
  const light=quality==='low'?null:new T.PointLight(0xff9c41,0,5.8,2);
  // Keep light count constant for the renderer, even when a slot is idle.
  if(light)scene.add(light);
  pool.push({group,carrier,core,flame,footprint,hotspot,plume,fragments,sparks,light,
   started:0,active:false,from:new T.Vector3(),to:new T.Vector3(),radius:0,flight:0,lead:0,total:0,size:1,height:1});
 }
 const position=(s,t,v)=>v.copy(s.from).lerp(s.to,t).setY(blend(s.from.y,s.to.y,t)+s.height*Math.sin(Math.PI*t));
 function animate(s,age){
  const p=clamp((age-s.lead)/s.flight);
  const a=age-s.lead-s.flight;
  const forming=smooth(.055,.25,age), hit=a>=0;
  const flare=smooth(.73,1,p), fade=smooth(0,.15,age)*(1-smooth(.92,1.13,p+(hit?a*3:0)));
  const power=hit?(1-smooth(.018,.72,a)):0;
  s.carrier.visible=!hit&&forming>.001;
  position(s,p,s.carrier.position);
  if(age<s.lead)s.carrier.position.y-=.22*(1-forming);
  position(s,Math.max(0,p-.013),local);position(s,Math.min(1,p+.013),tangent);
  delta.subVectors(local,tangent).normalize();
  if(delta.lengthSq()<1e-6)delta.set(.32,.82,.15).normalize();
  s.carrier.quaternion.setFromUnitVectors(unitZ,delta);
  const size=s.size*(.52+.48*forming);
  s.carrier.scale.set(size*(1+.07*flare),size*(1+.07*flare),size*(1-.16*flare));
  s.core.rotation.set(age*1.32,age*1.09,age*.71);
  for(let l=0;l<3;l++){
   const m=s.flame[l],u=m.material.uniforms;u.time.value=age;u.progress.value=flare;
   u.fade.value=fade;u.heat.value=[1.25,2.18,3.5][l]*(1+.17*flare);
  }
  const growth=hit?1-Math.exp(-a*7.8):smooth(0,.18,age);
  s.footprint.visible=hit||age<s.lead+.10;
  s.footprint.position.copy(hit?s.to:s.from);s.footprint.position.y=(hit?s.to.y:s.from.y)+.025;
  s.footprint.scale.setScalar(hit?Math.max(.001,s.radius*growth/.78):Math.max(.001,s.size*(.21+growth)));
  const ring=s.footprint.material.uniforms;
  ring.time.value=age;ring.fade.value=hit?power:(forming+.14)*(1-smooth(s.lead,s.lead+.10,age));ring.width.value=hit?.016:.031;
  const column=!hit&&age<s.lead;
  s.plume.visible=column||power>.002;s.plume.position.copy(hit?s.to:s.from);
  const u=s.plume.material.uniforms;u.time.value=age;u.fade.value=hit?power*smooth(0,.022,a):.48*forming;
  s.plume.scale.setScalar(Math.max(.001,s.size*(hit?(.65+.67*Math.sin(Math.PI*clamp((a+.10)/.68))):.23*forming)));
  s.hotspot.visible=hit&&a<.51;s.hotspot.position.copy(s.to);s.hotspot.position.y+=.038;
  s.hotspot.scale.setScalar(s.radius*(.35+.29*growth));s.hotspot.material.uniforms.fade.value=power*.42;
  s.hotspot.material.uniforms.time.value=age;
  if(s.light){
   s.light.position.copy(hit?s.to:s.carrier.position);
   if(hit)s.light.position.y+=.56;
   s.light.intensity=hit?13.5*power:1.8*forming+3.6*flare;
  }
  for(const [inst,total,rock] of [[s.fragments,palette.debris,true],[s.sparks,palette.embers,false]]){
   for(let n=0;n<total;n++){
    const theta=n*2.39996, seed=((n*53+17)%97)/97;
    const loop=(age*(1.07+seed*.77)+seed)%1;
    if(hit){
     const radial=(s.radius*(.26+.72*seed))*Math.min(1,a*2.25);
     temp.position.copy(s.to);
     temp.position.x+=cos(theta)*radial;temp.position.z+=sin(theta)*radial;
     temp.position.y+=Math.max(.033,(.9+2.6*seed)*(2.28*a-2.88*a*a))*(rock?.81:1.3);
    }else{
     temp.position.set(cos(theta)*(.54+.27*seed)*s.size,sin(theta)*(.54+.29*seed)*s.size,(.61+2.89*loop)*s.size);
     temp.position.x+=.97*loop*loop*s.size;
     temp.position.applyQuaternion(s.carrier.quaternion).add(s.carrier.position);
     if(column){
      temp.position.copy(s.from);
      temp.position.x+=cos(theta)*(.35+.45*seed)*s.size;temp.position.z+=sin(theta)*.62*seed*s.size;
      temp.position.y+=loop*1.46*s.size;
     }
    }
    const m=s.size*(rock?(hit?.095+.29*seed:.054+.145*seed):.011+.043*seed);
    const sz=m*(hit?power:forming*(.79+.21*Math.sin(loop*TAU)))*(column&&rock?0:1);
    temp.rotation.set(theta+age*3,n+age*4,n*.6-age*2);
    temp.scale.set(sz,sz*(rock?1.19:.67),sz*(rock?.91:2.45));
    temp.updateMatrix();inst.setMatrixAt(n,temp.matrix);
   }
   inst.instanceMatrix.needsUpdate=true;
  }
 }
 function hide(s){s.active=false;s.group.visible=false;if(s.light)s.light.intensity=0;}
 return {
  quality,capacity,
  spawn({from,to,start=0,flight=.7,lead=.22,radius=3.7,size=.59,height=4.2}){
   if(disposed)throw Error('Comet pool disposed');
   if(!from?.isVector3||!to?.isVector3||![...from,...to,start,flight,lead,radius,size,height].every(Number.isFinite)||
       flight<=0||lead<0||radius<=0||size<=0||height<0)throw Error('Invalid comet event');
   const s=pool.find(o=>!o.active);
   if(!s)return false;
   Object.assign(s,{active:true,started:start,flight,lead,radius,size,height,total:lead+flight+.79});
   s.from.copy(from);s.to.copy(to);s.group.visible=false;return true;
  },
  update(now){
   if(disposed)return;
   for(const s of pool){
    if(!s.active)continue;
    const t=now-s.started;
    if(t<0){s.group.visible=false;if(s.light)s.light.intensity=0;continue;}
    if(t>s.total){hide(s);continue;}
    s.group.visible=true;animate(s,t);
   }
  },
  reset(){pool.forEach(hide);},
  get active(){return pool.filter(s=>s.active).length;},
  dispose(){
   if(disposed)return;disposed=true;pool.forEach(hide);
   for(const s of pool){
    s.group.removeFromParent();s.light?.removeFromParent();s.fragments.dispose();s.sparks.dispose();
    for(const o of [...s.flame,s.footprint,s.hotspot,s.plume])o.material.dispose();
   }
   [...geometries,burst,petalPlane,debrisGeometry,emberGeometry].forEach(g=>g.dispose());
   cinder.dispose();ember.dispose();atlases.forEach(t=>t.dispose());
   const seen=new Set();
   gltf.scene.traverse(o=>{if(o.isMesh)for(const m of [o.material].flat())for(const r of [o.geometry,m,...Object.values(m).filter(x=>x?.isTexture)])if(!seen.has(r)){seen.add(r);r.dispose();}});
  },
 };
}
const {sin,cos}=Math;
