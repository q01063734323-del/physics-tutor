import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const dir=new URL('../public/royale/remaster/',import.meta.url);
async function readGlb(name){
 const file=await readFile(new URL(name+'.glb',dir));
 assert.equal(file.toString('ascii',0,4),'glTF');
 assert.equal(file.readUInt32LE(4),2);
 assert.equal(file.readUInt32LE(8),file.byteLength);
 const data=JSON.parse(file.toString('utf8',20,20+file.readUInt32LE(12)));
 assert.ok(data.extensionsUsed.includes('EXT_meshopt_compression'),name);
 return data;
}

const arena=await readGlb('sky-arena');
const towerNames=['04 Blue keep','04 Red keep','05 Blue left turret','05 Blue right turret','05 Red left turret','05 Red right turret'];
for(const name of towerNames){
 const tower=arena.nodes.find(node=>node.name===name);
 assert.ok(tower?.children?.length,name+' remains independently visible');
}
const acted=new Set(arena.animations.flatMap(clip=>clip.channels.map(channel=>arena.nodes[channel.target.node]?.name)));
for(const name of ['Drifting cloud bank','Waving Physics Royale','Water','Aether heart','Levitating jewel']){
 assert.ok([...acted].some(n=>n?.includes(name)),name+' has exported motion');
}
assert.ok(arena.images.length>=4,'Water and stone texture bakes');
for(const name of ['rider','frost','ember','ballista','meteor','hunters','hunters-silver']){
 const card=await readGlb(name);
 assert.ok(card.skins?.length,name+' has a rig');
 const clips=card.animations.map(clip=>clip.name);
 for(const clip of ['Idle','Walk','Run','Attack','Hit','Defeat','Spawn','Victory'])assert.ok(clips.includes(clip),name+' '+clip);
 assert.equal(clips.length,9,name);
}
console.log('Remaster assets passed: six arena anchors, moving environment, texture bakes, Meshopt, and nine animation clips per model.');
