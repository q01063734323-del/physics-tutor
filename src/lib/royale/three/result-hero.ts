import * as T from 'three';
import {loadKingdomAsset,disposeKingdomScene} from './kingdom-resources';

export async function mountResultHero(canvas:HTMLCanvasElement,win:boolean,detail:boolean,signal:AbortSignal){
 const {scene:model,animations}=await loadKingdomAsset('/royale/dawn-knight/knight-'+(detail?'high':'medium')+'.glb',signal);
 if(signal.aborted){disposeKingdomScene(model);return;}
 let renderer:T.WebGLRenderer;
 try{renderer=new T.WebGLRenderer({canvas,alpha:true,antialias:true});}
 catch(error){disposeKingdomScene(model);throw error;}
 renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.15;
 const scene=new T.Scene(),camera=new T.OrthographicCamera();
 const bounds=new T.Box3().setFromObject(model);
 const size=bounds.getSize(new T.Vector3()), center=bounds.getCenter(new T.Vector3());
 const pivot=new T.Group();model.position.sub(center);pivot.add(model);
 pivot.rotation.y=win?.42:-.21;
 scene.add(pivot,new T.HemisphereLight(win?0xffe0bb:0xb5cdff,0x5c465e,2.25));
 const key=new T.DirectionalLight(win?0xffd28b:0xcddbff,3.1);
 key.position.set(win?-3:3,5,5);scene.add(key);
 const rim=new T.DirectionalLight(win?0xffb05a:0xb9a0ff,2.0);
 rim.position.set(1,3,-4);scene.add(rim);
 camera.position.set(win?.36:.12,.18,7);camera.lookAt(0,.09,0);
 const mixer=new T.AnimationMixer(model);
 // The arena's Defeat clip is a fall. Keep the results portrait standing.
 const clip=animations.find(item=>item.name===(win?'Victory':'Idle'));
 if(clip){const action=mixer.clipAction(clip);action.setLoop(T.LoopOnce,1);action.clampWhenFinished=true;action.play();}
 if(!win)mixer.setTime(Math.min(.35,clip?.duration??0));
 const motion=matchMedia('(prefers-reduced-motion: reduce)');
 let frame=0,started:number|undefined,disposed=false;
 function resize(){
  const w=Math.max(1,canvas.clientWidth),h=Math.max(1,canvas.clientHeight);
  const height=Math.max(size.y*1.46,size.x*1.45*h/w);
  camera.top=height/2;camera.bottom=-height/2;
  camera.right=height*w/h/2;camera.left=-camera.right;
  camera.near=.1;camera.far=25;camera.updateProjectionMatrix();
  renderer.setPixelRatio(Math.min(devicePixelRatio,detail?1.4:1));renderer.setSize(w,h,false);
  renderer.render(scene,camera);
 }
 const observer=new ResizeObserver(resize);observer.observe(canvas);
 function tick(time:number){
  if(disposed||signal.aborted)return;
  started??=time;
  const elapsed=(time-started)/1000;
  if(!motion.matches){mixer.setTime(Math.min(elapsed,clip?.duration??0));renderer.render(scene,camera);}
  if(!motion.matches&&elapsed<(clip?.duration??0))frame=requestAnimationFrame(tick);
 }
 resize();canvas.dataset.heroReady='true';if(win)frame=requestAnimationFrame(tick);
 return ()=>{
  disposed=true;observer.disconnect();cancelAnimationFrame(frame);mixer.stopAllAction();mixer.uncacheRoot(model);
  disposeKingdomScene(model);renderer.dispose();renderer.forceContextLoss();delete canvas.dataset.heroReady;
 };
}
