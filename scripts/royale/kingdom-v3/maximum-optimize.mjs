import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
const require = createRequire(process.env.KINGDOM_EXPORT_PACKAGE || import.meta.url);
const { NodeIO } = require('@gltf-transform/core');
const { ALL_EXTENSIONS } = require('@gltf-transform/extensions');
const { dedup, join, meshopt, prune, weld, textureCompress } = require('@gltf-transform/functions');
const { MeshoptEncoder, MeshoptDecoder } = require('meshoptimizer');
const sharp = require('sharp');

await Promise.all([MeshoptEncoder.ready,MeshoptDecoder.ready]);
const [source,dest,level]=process.argv.slice(2);
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.encoder':MeshoptEncoder,'meshopt.decoder':MeshoptDecoder});
const doc=await io.read(source);
for (const material of doc.getRoot().listMaterials()) {
 if (material.getName()==='Painted crown sprays') {
  material.setAlphaMode('MASK').setAlphaCutoff(.34).setDoubleSided(true);
 }
}
if(level==='low'){
 for(const material of doc.getRoot().listMaterials()) {
  material.setNormalTexture(null);
 }
}
await doc.transform(dedup(), join({
 filter: node => !node.getParentNode() && !/^(VEG_|Distant|Foreground|High distant)/.test(node.getName()),
}), weld(), dedup(), prune(),
 textureCompress({encoder:sharp,targetFormat:'webp',slots:/baseColorTexture|normalTexture/,resize:level==='low'?[224,224]:level==='medium'?[384,384]:level==='ultra'?[768,768]:[448,448],quality:level==='ultra'?89:82}),
 textureCompress({encoder:sharp,targetFormat:'webp',slots:/occlusionTexture|metallicRoughnessTexture/,resize:level==='ultra'?[384,384]:[192,192],quality:79}),
 meshopt({encoder:MeshoptEncoder,level:'medium'}),
);
await io.write(dest,doc);
const root=doc.getRoot();
console.log(JSON.stringify({meshes:root.listMeshes().length,materials:root.listMaterials().length,
 textures:root.listTextures().length,bytes:(await fs.stat(dest)).size,
 triangles:root.listMeshes().flatMap(m=>m.listPrimitives()).reduce((n,o)=>n+(o.getIndices()?.getCount()??o.getAttribute('POSITION').getCount())/3,0),
 prototypeNodes:root.listNodes().map(o=>o.getName()).filter(s=>s.startsWith('VEG_')),
},null,2));
