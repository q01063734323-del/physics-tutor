import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, meshopt, prune, weld } from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptDecoder } from 'meshoptimizer';

await Promise.all([MeshoptEncoder.ready, MeshoptDecoder.ready]);
const [src, target] = process.argv.slice(2);
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS)
 .registerDependencies({'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder});
const document = await io.read(src);
await document.transform(weld(), dedup(), prune(), meshopt({encoder: MeshoptEncoder, level: 'medium'}));
await io.write(target, document);
const meshes = document.getRoot().listMeshes();
const triangles = meshes.flatMap(mesh => mesh.listPrimitives()).reduce((sum, primitive) => sum + primitive.getIndices().getCount() / 3, 0);
console.log(JSON.stringify({meshes: meshes.length, triangles, materials: document.getRoot().listMaterials().length}));
