import * as T from 'three';

/** Painted sky gradient in screen space so the battle camera needs no backdrop mesh. */
export function createSkyBackground() {
 const canvas=document.createElement('canvas');
 canvas.width=512;
 canvas.height=512;
 const ctx=canvas.getContext('2d');
 if(!ctx)return null;
 const sky=ctx.createLinearGradient(0,0,0,512);
 sky.addColorStop(0,'#525f92');
 sky.addColorStop(.37,'#7f92c3');
 sky.addColorStop(.65,'#9cadd3');
 sky.addColorStop(1,'#4a5d92');
 ctx.fillStyle=sky;
 ctx.fillRect(0,0,512,512);
 const light=ctx.createRadialGradient(378,104,8,378,104,270);
 light.addColorStop(0,'#f9d6aca7');
 light.addColorStop(.34,'#e3b7a84d');
 light.addColorStop(1,'#caa8c200');
 ctx.fillStyle=light;
 ctx.fillRect(0,0,512,512);
 const texture=new T.CanvasTexture(canvas);
 texture.colorSpace=T.SRGBColorSpace;
 return texture;
}
