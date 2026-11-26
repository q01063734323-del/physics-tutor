import * as T from 'three';

/** Curtain edges break up across lanes and dissolve near the ground. */
export function createWaterfallAlpha(){
 const side=128,data=new Uint8Array(side*side*4);
 const smooth=(a:number,b:number,x:number)=>T.MathUtils.smoothstep(x,a,b);
 for(let y=0;y<side;y++)for(let x=0;x<side;x++){
  const u=x/(side-1),v=y/(side-1);
  const edge=smooth(0,.13,u)*(1-smooth(.87,1,u));
  const lane=.74+.12*Math.sin(u*91+Math.sin(v*19)*.53)+.11*Math.sin(u*211-v*6);
  const a=Math.round(255*edge*smooth(.015,.25,v)*lane);
  const pos=(y*side+x)*4;
  data.set([a,a,a,255],pos);
 }
 const texture=new T.DataTexture(data,side,side);
 // glTF UV V points downward. DataTexture retains our authored row order.
 texture.flipY=true;
 texture.magFilter=T.LinearFilter;
 texture.minFilter=T.LinearFilter;
 texture.needsUpdate=true;
 return texture;
}
