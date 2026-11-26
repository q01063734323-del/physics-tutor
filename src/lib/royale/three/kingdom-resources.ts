import * as T from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';

export async function loadKingdomAsset(url: string, signal: AbortSignal) {
 const response = await fetch(url, {signal, cache:'force-cache'});
 if (!response.ok) throw Error('3D-ресурс недоступен');
 const bytes = await response.arrayBuffer();
 signal.throwIfAborted();
 return new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parseAsync(bytes, url.slice(0, url.lastIndexOf('/')+1));
}

export function disposeKingdomScene(root: T.Object3D) {
 const resources = new Set<T.BufferGeometry|T.Material|T.Texture|T.Skeleton>();
 const images = new Set<ImageBitmap>();
 root.traverse(node=>{
  if (!(node instanceof T.Mesh)) return;
  resources.add(node.geometry);
  if (node instanceof T.SkinnedMesh) resources.add(node.skeleton);
  for (const material of [node.material].flat()) {
   resources.add(material);
   for (const value of Object.values(material)) if (value instanceof T.Texture) {
    resources.add(value);
    if(typeof ImageBitmap!=='undefined' && value.image instanceof ImageBitmap) images.add(value.image);
   }
  }
 });
 resources.forEach(value=>value.dispose());
 images.forEach(image=>image.close());
}
