import * as T from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import type { CardId } from '../config';
import { figureAsset } from './figure-assets';
import { disposeKingdomScene, loadKingdomAsset } from './kingdom-resources';
import type { GraphicsQuality } from '../quality';

export function mountKingdomPreview(canvas: HTMLCanvasElement, id: CardId, quality: GraphicsQuality,
 onReady: (animations: string[])=>void, onError: ()=>void) {
 const gl = new T.WebGLRenderer({canvas, alpha:true, antialias:quality!=='low'});
 gl.setClearColor(0,0);
 gl.toneMapping=T.ACESFilmicToneMapping;
 gl.toneMappingExposure=1.22;
 const scene=new T.Scene(), camera=new T.PerspectiveCamera(35,1,.01,40);
 const environment=quality==='low'?undefined:new RoomEnvironment();
 const probes=environment?new T.PMREMGenerator(gl):undefined;
 const reflected=environment&&probes?probes.fromScene(environment,.045):undefined;
 environment?.dispose();probes?.dispose();
 if(reflected){scene.environment=reflected.texture;scene.environmentIntensity=.52;}
 const rig=new T.Group();
 scene.add(rig, new T.HemisphereLight(0xc5d6ff,0x504070,2.7));
 for (const [color,intensity,x,y,z] of [[0xffdbae,3.2,3,5,4],[0xb1c1ff,2,-3,3,-2],[0xb696ff,1.2,-3,2,2]]) {
  const light=new T.DirectionalLight(color,intensity);
  light.position.set(x,y,z);scene.add(light);
 }
 const pedestal=new T.Mesh(new T.CylinderGeometry(.84,.93,.18,48,1),new T.MeshStandardMaterial({color:0x182641,roughness:.59,metalness:.37}));
 pedestal.position.y=-1.06;
 const ring=new T.Mesh(new T.TorusGeometry(.84,.022,9,64),new T.MeshStandardMaterial({color:0xe8b364,roughness:.43,metalness:.44}));
 ring.rotation.x=-Math.PI/2;ring.position.y=-.97;
 scene.add(pedestal,ring);
 const shadowCanvas=document.createElement('canvas');shadowCanvas.width=shadowCanvas.height=64;
 const ink=shadowCanvas.getContext('2d')!;
 const soft=ink.createRadialGradient(32,32,1,32,32,32);
 soft.addColorStop(0,'rgba(2,3,16,.64)');soft.addColorStop(1,'rgba(2,3,16,0)');
 ink.fillStyle=soft;ink.fillRect(0,0,64,64);
 const shadowMap=new T.CanvasTexture(shadowCanvas);
 const contact=new T.Mesh(new T.PlaneGeometry(1.31,1.14),new T.MeshBasicMaterial({map:shadowMap,transparent:true,depthWrite:false}));
 contact.rotation.x=-Math.PI/2;contact.position.y=-.963;scene.add(contact);
 const controls=new OrbitControls(camera,canvas);
 const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
 controls.enableDamping=!reduce;controls.enablePan=false;
 controls.minDistance=2.2;controls.maxDistance=7;controls.maxPolarAngle=Math.PI*.78;
 const reset=()=>{rig.rotation.y=0;camera.position.set(1.12,.56,4.85);controls.target.set(0,.04,0);controls.update();};
 reset();
 const abort=new AbortController();
 let mixer:T.AnimationMixer|undefined;
 let clips:T.AnimationClip[]=[];
 let root:T.Object3D|undefined;
 let current:T.AnimationAction|undefined;
 let visible=true, frame=0, last=0;
 const autoQuality=matchMedia('(max-width: 700px)').matches?'low':'medium';
 const limit=quality==='high'?1.7:quality==='medium'?1.25:quality==='auto'&&autoQuality==='medium'?1.25:1;
 const resize=new ResizeObserver(()=>{
  const width=canvas.clientWidth,height=canvas.clientHeight;
  if(!width||!height)return;
  camera.aspect=width/height;camera.updateProjectionMatrix();
  gl.setPixelRatio(Math.min(devicePixelRatio||1,limit));gl.setSize(width,height,false);
 });
 resize.observe(canvas);
 const observer=new IntersectionObserver(([entry])=>{visible=entry.isIntersecting;});
 observer.observe(canvas);
 function draw(time:number){
  frame=requestAnimationFrame(draw);
  if(!visible||document.hidden){last=0;return;}
  const interval=quality==='low'||(quality==='auto'&&autoQuality==='low')?32:15;
  if(last&&time-last<interval)return;
  mixer?.update(last?Math.min((time-last)/1000,.07):0);last=time;
  controls.update();gl.render(scene,camera);
 }
 const play=(name:string)=>{
  const clip=clips.find(item=>item.name===name);
  if(!clip||!mixer)return;
  current?.stop();
  current=mixer.clipAction(clip).reset().play();
 };
 void loadKingdomAsset(figureAsset(id,quality==='auto'?autoQuality:quality),abort.signal).then(asset=>{
  if(abort.signal.aborted){disposeKingdomScene(asset.scene);return;}
  root=asset.scene;
  const bounds=new T.Box3().setFromObject(root);
  const size=bounds.getSize(new T.Vector3()),center=bounds.getCenter(new T.Vector3());
  const scale=1.93/Math.max(size.x,size.y,size.z,.01);
  root.position.copy(center.multiplyScalar(-1));
  rig.add(root);rig.scale.setScalar(scale);
  rig.position.y=size.y*scale/2-.97;
  if(id!=='knight'&&id!=='fireball'&&id!=='meteor'&&id!=='spears')root.rotation.y+=Math.PI;
  mixer=new T.AnimationMixer(root);
  clips=asset.animations;
  onReady(clips.map(clip=>clip.name));
  if(!reduce){const idle=clips.find(clip=>clip.name==='Idle');if(idle)play(idle.name);}
 }).catch(()=>{if(!abort.signal.aborted)onError();});
 frame=requestAnimationFrame(draw);
 return {play, reset, rotate(delta:number){rig.rotateY(delta);},zoom(factor:number){
  const offset=camera.position.clone().sub(controls.target);
  const distance=T.MathUtils.clamp(offset.length()*factor,controls.minDistance,controls.maxDistance);
  camera.position.copy(controls.target).add(offset.setLength(distance));controls.update();
 },dispose(){
  abort.abort();cancelAnimationFrame(frame);resize.disconnect();observer.disconnect();controls.dispose();
  mixer?.stopAllAction();if(root)mixer?.uncacheRoot(root);
  disposeKingdomScene(scene);reflected?.dispose();gl.dispose();
 }};
}
