import fs from 'node:fs/promises';
import * as T from 'three';
import {GLTFExporter} from 'three/addons/exporters/GLTFExporter.js';
// The exporter needs this browser primitive; source artwork is entirely local geometry.
class ExportReader{result=null;onloadend=null;readAsArrayBuffer(blob){void blob.arrayBuffer().then(data=>{this.result=data;this.onloadend?.();});}readAsDataURL(blob){void blob.arrayBuffer().then(data=>{this.result='data:'+blob.type+';base64,'+Buffer.from(data).toString('base64');this.onloadend?.();});}}
globalThis.FileReader=ExportReader;
const root=new T.Group();root.name='OriginalPhysicsCitadelCrystal';
const stone=new T.MeshStandardMaterial({color:0x9aa5a6,roughness:.9,flatShading:true}),gold=new T.MeshStandardMaterial({color:0xdab776,metalness:.35,roughness:.5}),gem=new T.MeshStandardMaterial({color:0x8ae1dc,emissive:0x235f66,emissiveIntensity:.4,roughness:.3,metalness:.12,flatShading:true});
const base=new T.Mesh(new T.CylinderGeometry(.42,.55,.35,8),stone);base.position.y=.18;root.add(base);
const rim=new T.Mesh(new T.TorusGeometry(.38,.06,5,8),gold);rim.rotation.x=Math.PI/2;rim.position.y=.42;root.add(rim);
const crystal=new T.Mesh(new T.OctahedronGeometry(.43,0),gem);crystal.name='FloatingCrystal';crystal.scale.set(.7,1.5,.7);crystal.position.y=1;root.add(crystal);
const track=new T.VectorKeyframeTrack('FloatingCrystal.position',[0,1.5,3],[0,1,0,0,1.12,0,0,1,0]);const spin=new T.QuaternionKeyframeTrack('FloatingCrystal.quaternion',[0,1.5,3],[0,0,0,1,0,1,0,0,0,0,0,-1]);const clip=new T.AnimationClip('CrystalIdle',3,[track,spin]);
const exporter=new GLTFExporter();const bytes=await exporter.parseAsync(root,{binary:true,animations:[clip]});
await fs.mkdir('public/royale/3d',{recursive:true});await fs.writeFile('public/royale/3d/citadel-crystal.glb',Buffer.from(bytes));console.log('Original animated GLB:',bytes.byteLength,'bytes');
root.traverse(node=>{if(node.isMesh)node.geometry.dispose();});[stone,gold,gem].forEach(m=>m.dispose());
