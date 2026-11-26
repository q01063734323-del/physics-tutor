import * as T from 'three';
import type {ArenaQuality} from './arena-model';

export function createSkyMotes(scene:T.Scene) {
 const geometry=new T.IcosahedronGeometry(.027,0);
 const material=new T.MeshBasicMaterial({color:0x82dcff,transparent:true,opacity:.68,depthWrite:false,blending:T.AdditiveBlending});
 const spray=new T.InstancedMesh(geometry,material,96);
 const matrix=new T.Object3D();
 const centers=[[-7.75,.99],[7.75,.99],[-1.75,.04],[1.65,.03],[-7.75,17.8],[7.75,17.8],[0,-24.6]];
 spray.count=0;spray.frustumCulled=false;spray.renderOrder=4;
 scene.add(spray);
 return {
  update(seconds:number,quality:ArenaQuality,visible:boolean){
   const count=!visible||quality==='low'?0:quality==='medium'?34:77;
   spray.count=count;
   for(let i=0;i<count;i++){
    const anchor=centers[i%centers.length];
    const a=i*2.3999;
    const t=(seconds*(.46+.07*(i%4))+i*.619)%1;
    matrix.position.set(anchor[0]+(.21+.61*t)*Math.cos(a),
     (anchor[1]>7?-.52:.28)+(1-t)*.85*Math.sin(Math.PI*t),anchor[1]+t*.72*Math.sin(a));
    matrix.rotation.set(a,t*4,t*4);
    matrix.scale.setScalar((1-t)*1.35);
    matrix.updateMatrix();
    spray.setMatrixAt(i,matrix.matrix);
   }
   if(count)spray.instanceMatrix.needsUpdate=true;
  },
  dispose(){spray.removeFromParent();spray.dispose();geometry.dispose();material.dispose();},
 };
}
