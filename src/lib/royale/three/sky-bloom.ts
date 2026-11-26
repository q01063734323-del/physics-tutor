import {type Camera,type Scene,type WebGLRenderer,Vector2} from 'three';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {UnrealBloomPass} from 'three/addons/postprocessing/UnrealBloomPass.js';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';

export function createSkyBloom(renderer:WebGLRenderer,scene:Scene,camera:Camera) {
 const composer=new EffectComposer(renderer);
 const scenePass=new RenderPass(scene,camera);
 const bloom=new UnrealBloomPass(new Vector2(1,1),.19,.43,1.12);
 const output=new OutputPass();
 composer.addPass(scenePass);
 composer.addPass(bloom);
 composer.addPass(output);
 return {
  resize(width:number,height:number,ratio:number){
   composer.setPixelRatio(Math.min(1.5,ratio));
   composer.setSize(width,height);
  },
  render(){composer.render();},
  dispose(){scenePass.dispose();bloom.dispose();output.dispose();composer.dispose();},
 };
}
