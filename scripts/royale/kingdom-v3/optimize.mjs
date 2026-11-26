import fs from 'node:fs/promises';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, meshopt, prune, weld, textureCompress } from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptDecoder } from 'meshoptimizer';
import sharp from 'sharp';

await Promise.all([MeshoptEncoder.ready,MeshoptDecoder.ready]);
const [source,dest,level]=process.argv.slice(2);
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.encoder':MeshoptEncoder,'meshopt.decoder':MeshoptDecoder});
const doc=await io.read(source);
if(level==='low'){
 for(const material of doc.getRoot().listMaterials()) {
  material.setNormalTexture(null);
 }
}
await doc.transform(weld(), dedup(), prune(),
 textureCompress({encoder:sharp,targetFormat:'webp',slots:/baseColorTexture|normalTexture/,resize:level==='low'?[192,192]:level==='medium'?[288,288]:[384,384],quality:86}),
 textureCompress({encoder:sharp,targetFormat:'webp',slots:/occlusionTexture|metallicRoughnessTexture/,resize:[192,192],quality:78}),
 meshopt({encoder:MeshoptEncoder,level:'medium'}),
);
await io.write(dest,doc);
const root=doc.getRoot();
console.log(JSON.stringify({meshes:root.listMeshes().length,materials:root.listMaterials().length,
 textures:root.listTextures().length,bytes:(await fs.stat(dest)).size,
 triangles:root.listMeshes().flatMap(m=>m.listPrimitives()).reduce((n,o)=>n+(o.getIndices()?.getCount()??o.getAttribute('POSITION').getCount())/3,0),
 prototypeNodes:root.listNodes().map(o=>o.getName()).filter(s=>s.startsWith('VEG_')),
},null,2));
