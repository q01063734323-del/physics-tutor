import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const qualityLevels=['high','medium','low'];
const root=new URL('../public/royale/sky6/',import.meta.url);
const towers={
 '04 Blue keep':[0,0,14.9],
 '04 Red keep':[0,0,-14.9],
 '05 Blue left turret':[-5,0,11.7],
 '05 Blue right turret':[5,0,11.7],
 '05 Red left turret':[-5,0,-11.7],
 '05 Red right turret':[5,0,-11.7],
};
const weights=[];
for(const quality of qualityLevels){
 const bytes=await readFile(new URL('sky-arena-'+quality+'.glb',root));
 assert.equal(bytes.toString('ascii',0,4),'glTF');
 assert.equal(bytes.byteLength,bytes.readUInt32LE(8));
 const model=JSON.parse(bytes.toString('utf8',20,20+bytes.readUInt32LE(12)));
 assert(model.extensionsUsed.includes('EXT_meshopt_compression'));
 for(const [name,expected] of Object.entries(towers)){
  const anchor=model.nodes.find(node=>node.name===name);
  assert.ok(anchor?.children?.length,name);
  assert.ok(anchor.translation.every((x,i)=>Math.abs(x-expected[i])<.0001),name+' must use the existing battle grid');
 }
 const channels=model.animations.flatMap(clip=>clip.channels);
 for(const animation of ['Floating watchtower crystal','Animated textile','Drifting cloud bank','Wind animated canopy']){
  assert.ok(channels.some(channel=>model.nodes[channel.target.node]?.name.startsWith(animation)),quality+': '+animation);
 }
 assert.ok(model.images.length>=7,'Painted materials must be embedded');
 assert.ok(model.meshes.some(mesh=>mesh.primitives.some(primitive=>primitive.attributes.COLOR_0!==undefined)));
 assert.ok(model.materials.some(mat=>mat.name.startsWith('Canal')));
 assert.ok(model.materials.some(mat=>mat.name.startsWith('Waterfall')));
 const tri=model.meshes.flatMap(mesh=>mesh.primitives).reduce((n,p)=>n+model.accessors[p.indices].count/3,0);
 weights.push({quality,bytes:bytes.length,tri});
}
assert.ok(weights[0].tri>weights[1].tri&&weights[1].tri>weights[2].tri);
assert.ok(weights[2].tri<weights[0].tri*.62);
console.log('Sky Arena 6 geometry, stage anchors, animation targets, PBR textures and LOD contracts passed.',weights);
