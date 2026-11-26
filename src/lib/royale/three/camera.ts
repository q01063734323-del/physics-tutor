import {OrthographicCamera,Vector3} from 'three';
import {arenaWorld} from './coordinates';
export function createBattleCamera(){const camera=new OrthographicCamera(-12,12,20,-20,.1,160);camera.position.set(0,29,37);camera.lookAt(0,.3,0);camera.updateMatrixWorld(true);return camera;}
/** Fit ALL scene corners, including the tallest tower; never change gameplay geometry. */
export function fitBattleCamera(camera:OrthographicCamera,aspect:number){
 camera.updateMatrixWorld(true);let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;const point=new Vector3();
 for(const x of [-arenaWorld.width/2-1,arenaWorld.width/2+1])for(const z of [-arenaWorld.depth/2-1,arenaWorld.depth/2+1])for(const y of [-1.3,4.8]){point.set(x,y,z).applyMatrix4(camera.matrixWorldInverse);minX=Math.min(minX,point.x);maxX=Math.max(maxX,point.x);minY=Math.min(minY,point.y);maxY=Math.max(maxY,point.y);}
 const safeAspect=Math.max(.2,Math.min(5,aspect||1)),cx=(minX+maxX)/2,cy=(minY+maxY)/2;
 const halfHeight=Math.max((maxY-minY)/2,(maxX-minX)/2/safeAspect)*1.035,halfWidth=halfHeight*safeAspect;
 camera.left=cx-halfWidth;camera.right=cx+halfWidth;camera.top=cy+halfHeight;camera.bottom=cy-halfHeight;camera.updateProjectionMatrix();
}
