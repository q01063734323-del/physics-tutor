import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import type {CardId,Side} from '../config';

export type ModelPose={time:number;moving:boolean;attack:number;hit:number;death:number;reducedMotion:boolean};
export type ModelRig={root:THREE.Group;body:THREE.Group;head?:THREE.Group;leftArm?:THREE.Group;rightArm?:THREE.Group;leftLeg?:THREE.Group;rightLeg?:THREE.Group;wings?:THREE.Group[];weapon?:THREE.Group;animate:(pose:ModelPose)=>void};
type Parts={head?:THREE.Group;leftArm?:THREE.Group;rightArm?:THREE.Group;leftLeg?:THREE.Group;rightLeg?:THREE.Group;wings?:THREE.Group[];weapon?:THREE.Group;extraLegs?:THREE.Group[];tail?:THREE.Group;static?:boolean};
const palette={steel:0xc1d2dc,steelDark:0x5a7186,gold:0xe6bd6f,skin:0xe8b78d,leather:0x6b4b43,wood:0x896342,woodLight:0xbf965d,bone:0xe8dec4,eye:0x122738,white:0xf2edda,stone:0xd4ceb8,base:0x637a83,violet:0x7866a6,ice:0xa8e8f0,fire:0xf69c52,fireLight:0xffdc87,scale:0x56b5a3,scaleDark:0x2b7e83,leaf:0x517b64,obsidian:0x4c455f};
type Paint=keyof typeof palette|'team'|'teamLight';

/** Original composed low-poly models. Geometry/material ownership belongs to this workshop. */
export class ModelWorkshop {
 private geometries=new Map<string,THREE.BufferGeometry>();
 private materials=new Map<string,THREE.MeshStandardMaterial>();
 private disposed=false;
 private geometry(key:string,make:()=>THREE.BufferGeometry){let geometry=this.geometries.get(key);if(!geometry){geometry=make();this.geometries.set(key,geometry);}return geometry;}
 private material(paint:Paint,side:Side){const key=paint==='team'||paint==='teamLight'?paint+side:paint;let material=this.materials.get(key);if(!material){const color=paint==='team'?(side==='player'?0x428db2:0xc26560):paint==='teamLight'?(side==='player'?0x8dd0d9:0xf0b080):palette[paint];material=new THREE.MeshStandardMaterial({color,roughness:paint==='gold'?.48:.84,metalness:paint==='gold'?.25:paint==='steel'?.18:0,flatShading:true,side:THREE.DoubleSide});if(paint==='ice'||paint==='fireLight'){material.emissive.setHex(color);material.emissiveIntensity=.22;}this.materials.set(key,material);}return material;}
 private mesh(parent:THREE.Object3D,geometry:THREE.BufferGeometry,paint:Paint,side:Side,x:number,y:number,z:number,sx=1,sy=1,sz=1){const mesh=new THREE.Mesh(geometry,this.material(paint,side));mesh.position.set(x,y,z);mesh.scale.set(sx,sy,sz);mesh.castShadow=true;mesh.receiveShadow=true;mesh.userData.detail=paint==='gold'&&sx*sy*sz<.015;parent.add(mesh);return mesh;}
 private box(parent:THREE.Object3D,paint:Paint,side:Side,x:number,y:number,z:number,sx:number,sy:number,sz:number){return this.mesh(parent,this.geometry('box',()=>new THREE.BoxGeometry(1,1,1)),paint,side,x,y,z,sx,sy,sz);}
 private ball(parent:THREE.Object3D,paint:Paint,side:Side,x:number,y:number,z:number,sx:number,sy=sx,sz=sx){return this.mesh(parent,this.geometry('sphere',()=>new THREE.SphereGeometry(1,10,7)),paint,side,x,y,z,sx,sy,sz);}
 private poly(parent:THREE.Object3D,paint:Paint,side:Side,x:number,y:number,z:number,sx:number,sy=sx,sz=sx){return this.mesh(parent,this.geometry('ico',()=>new THREE.IcosahedronGeometry(1,0)),paint,side,x,y,z,sx,sy,sz);}
 private cylinder(parent:THREE.Object3D,paint:Paint,side:Side,x:number,y:number,z:number,radius:number,height:number,top=radius){return this.mesh(parent,this.geometry(`cylinder:${radius?top/radius:1}`,()=>new THREE.CylinderGeometry(top/radius,1,1,10)),paint,side,x,y,z,radius,height,radius);}
 private cone(parent:THREE.Object3D,paint:Paint,side:Side,x:number,y:number,z:number,radius:number,height:number){return this.mesh(parent,this.geometry('cone',()=>new THREE.ConeGeometry(1,1,8)),paint,side,x,y,z,radius,height,radius);}
 private joint(parent:THREE.Object3D,x:number,y:number,z:number,name:string){const group=new THREE.Group();group.position.set(x,y,z);group.name=name;parent.add(group);return group;}
 private rod(parent:THREE.Object3D,paint:Paint,side:Side,a:THREE.Vector3,b:THREE.Vector3,radius:number){const direction=new THREE.Vector3().subVectors(b,a),mid=new THREE.Vector3().addVectors(a,b).multiplyScalar(.5);const mesh=this.cylinder(parent,paint,side,mid.x,mid.y,mid.z,radius,direction.length());mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),direction.normalize());return mesh;}
 private eyes(parent:THREE.Object3D,side:Side,y:number,z:number,width=.075){for(const sign of [-1,1]){this.box(parent,'white',side,sign*width,y,z,.065,.06,.025);this.box(parent,'eye',side,sign*width,y,z-.017,.025,.039,.015);}}
 private sword(parent:THREE.Object3D,side:Side){const weapon=this.joint(parent,0,-.2,0,'sword');this.box(weapon,'leather',side,0,-.1,0,.055,.2,.06);this.box(weapon,'gold',side,0,.01,0,.25,.055,.08);this.box(weapon,'steel',side,0,.28,0,.09,.48,.04);this.cone(weapon,'steel',side,0,.56,0,.065,.12);return weapon;}
 private shield(parent:THREE.Object3D,side:Side,heavy=false){const group=this.joint(parent,0,-.1,-.08,'shield');this.box(group,heavy?'obsidian':'team',side,0,-.03,-.04,heavy?.4:.32,.42,.09);this.cone(group,heavy?'obsidian':'team',side,0,-.31,-.04,heavy?.225:.18,.2).rotation.z=Math.PI;this.box(group,'gold',side,0,-.05,-.095,.045,.3,.025);this.box(group,'gold',side,0,-.01,-.095,.21,.04,.025);return group;}
 private bow(parent:THREE.Object3D,side:Side){const group=this.joint(parent,0,-.15,-.08,'bow');const curve=new THREE.CatmullRomCurve3([new THREE.Vector3(0,-.35,0),new THREE.Vector3(.14,-.18,-.06),new THREE.Vector3(.18,0,-.08),new THREE.Vector3(.14,.18,-.06),new THREE.Vector3(0,.35,0)]);const geometry=this.geometry('hand-bow',()=>new THREE.TubeGeometry(curve,10,.025,5,false));this.mesh(group,geometry,'woodLight',side,0,0,0);this.rod(group,'bone',side,new THREE.Vector3(0,-.35,0),new THREE.Vector3(0,.35,0),.009);this.rod(group,'wood',side,new THREE.Vector3(0,0,.08),new THREE.Vector3(0,0,-.55),.015);this.cone(group,'steel',side,0,0,-.6,.035,.12).rotation.x=-Math.PI/2;return group;}
 private humanoid(body:THREE.Group,side:Side,kind:CardId):Parts{
  const skeleton=kind==='skeletons',mage=kind==='mage'||kind==='frost',heavy=kind==='sentinel',archer=kind==='archers'||kind==='hunters'||kind==='spears',giant=kind==='giant';
  const chest:Paint=skeleton?'bone':mage?(kind==='frost'?'ice':'violet'):heavy?'obsidian':archer?'leaf':'team';
  const leftLeg=this.joint(body,-.12,.4,0,'left-leg'),rightLeg=this.joint(body,.12,.4,0,'right-leg');
  for(const leg of [leftLeg,rightLeg]){if(skeleton){this.cylinder(leg,'bone',side,0,-.11,0,.035,.23);this.ball(leg,'bone',side,0,-.22,0,.05);this.cylinder(leg,'bone',side,0,-.29,0,.027,.16);}else this.box(leg,heavy?'steelDark':'leather',side,0,-.14,0,.145,.28,.15);this.box(leg,skeleton?'bone':'steelDark',side,0,-.35,-.045,skeleton?.1:.17,.1,.25);}
  if(mage){this.cylinder(body,chest,side,0,.5,0,.3,.65,.16);this.cylinder(body,'gold',side,0,.23,0,.305,.05,.29);this.box(body,'gold',side,0,.57,-.182,.055,.45,.025);}else if(skeleton){this.cylinder(body,'bone',side,0,.62,0,.035,.42);for(let i=0;i<4;i++){const rib=this.box(body,'bone',side,0,.52+i*.075,-.025,.26,.035,.11);rib.rotation.z=i%2?.05:-.05;}this.box(body,'bone',side,0,.43,0,.22,.09,.12);}else{this.box(body,chest,side,0,.61,0,heavy?.52:.38,.41,.24);this.box(body,heavy?'steelDark':'gold',side,0,.44,-.015,.4,.055,.27);if(!archer){this.box(body,'steel',side,0,.66,-.142,heavy?.42:.27,.28,.045);this.poly(body,'gold',side,0,.68,-.185,.07,.09,.03);}else{const belt=this.box(body,'leather',side,0,.63,-.14,.065,.42,.04);belt.rotation.z=.55;}}
  const head=this.joint(body,0,.94,0,'head');this.ball(head,skeleton?'bone':'skin',side,0,0,-.01,skeleton?.17:.185,.19,.16);
  if(skeleton){this.box(head,'bone',side,0,-.16,-.025,.17,.08,.12);for(const sign of [-1,1])this.ball(head,'eye',side,sign*.07,.015,-.14,.052,.055,.025);this.box(head,'eye',side,0,-.12,-.09,.025,.03,.025);}else{
   this.eyes(head,side,.005,-.164);this.box(head,'skin',side,0,-.052,-.175,.042,.05,.035);
   if(mage){this.cone(head,kind==='frost'?'ice':'violet',side,0,.2,.02,.26,.42);this.cylinder(head,'gold',side,0,.025,.02,.27,.04);this.cone(head,'white',side,0,-.16,-.1,.095,.22).rotation.z=Math.PI;}
   else if(archer){this.ball(head,'leaf',side,0,.09,.045,.21,.15,.16);this.box(head,'leaf',side,0,.12,-.055,.38,.05,.25);if(kind==='hunters')this.cone(head,'gold',side,-.09,.27,.03,.045,.22).rotation.z=-.4;}
   else if(giant){this.ball(head,'leather',side,0,.13,.02,.2,.09,.17);this.box(head,'leather',side,0,-.13,-.04,.23,.09,.14);}
   else{this.ball(head,heavy?'obsidian':'steel',side,0,.075,.035,.22,.18,.19);this.box(head,heavy?'obsidian':'steel',side,0,.05,-.13,.37,.08,.1);this.box(head,'eye',side,0,-.015,-.17,.2,.045,.025);this.box(head,'gold',side,0,.08,-.19,.035,.23,.03);this.box(head,'team',side,0,.25,.02,.05,.16,.2);if(heavy)for(const sign of [-1,1]){const horn=this.cone(head,'gold',side,sign*.21,.12,.02,.065,.22);horn.rotation.z=-sign*.5;}}
  }
  const leftArm=this.joint(body,-(heavy?.34:.27),.78,0,'left-arm'),rightArm=this.joint(body,heavy?.34:.27,.78,0,'right-arm');
  for(const arm of [leftArm,rightArm]){this.ball(arm,skeleton?'bone':archer?'leaf':mage?chest:'steel',side,0,0,0,skeleton?.055:heavy?.14:.1);if(skeleton)this.cylinder(arm,'bone',side,0,-.16,0,.028,.3);else this.box(arm,mage?chest:archer?'leaf':'leather',side,0,-.15,0,.13,.29,.14);this.ball(arm,skeleton?'bone':'skin',side,0,-.32,0,.075);}
  let weapon:THREE.Group;
  if(mage){weapon=this.joint(rightArm,0,-.18,0,'staff');this.cylinder(weapon,'woodLight',side,0,.1,-.03,.028,.95);this.poly(weapon,kind==='frost'?'ice':'fireLight',side,0,.66,-.03,.115,.19,.115);this.cylinder(weapon,'gold',side,0,.48,-.03,.07,.07);}
  else if(kind==='spears'){weapon=this.joint(rightArm,0,-.15,0,'spear');this.cylinder(weapon,'woodLight',side,0,.14,0,.025,1.2);this.cone(weapon,'steel',side,0,.85,0,.065,.24);}
  else if(archer)weapon=this.bow(rightArm,side);
  else{weapon=this.sword(rightArm,side);if(kind==='knight'||kind==='guardians'||heavy)this.shield(leftArm,side,heavy);}
  if(kind==='guardians'){this.box(body,'teamLight',side,0,.7,.15,.35,.32,.045);}
  return {head,leftArm,rightArm,leftLeg,rightLeg,weapon};
 }
 private dragon(body:THREE.Group,side:Side):Parts{
  this.ball(body,'scale',side,0,.57,0,.34,.3,.55);this.ball(body,'scaleDark',side,0,.48,-.14,.26,.2,.4);
  const head=this.joint(body,0,.87,-.55,'head');this.box(head,'scale',side,0,0,-.08,.4,.28,.4);this.box(head,'scale',side,0,-.1,-.32,.33,.13,.22);for(const sign of [-1,1]){this.ball(head,'gold',side,sign*.195,.02,-.18,.04,.05,.04);this.cone(head,'bone',side,sign*.14,.22,.06,.055,.25).rotation.z=-sign*.25;this.cone(head,'bone',side,sign*.11,-.16,-.27,.025,.08).rotation.z=Math.PI;}
  for(let i=0;i<4;i++)this.cone(body,'violet',side,0,.85-i*.035,.4-i*.2,.07,.16);
  const tail=this.joint(body,0,.5,.45,'tail');const tailBase=this.cone(tail,'scale',side,0,0,.32,.17,.8);tailBase.rotation.x=Math.PI/2;this.cone(tail,'gold',side,0,0,.76,.08,.2).rotation.x=Math.PI/2;
  const wings:THREE.Group[]=[];for(const sign of [-1,1]){const wing=this.joint(body,sign*.23,.72,.08,'wing');wing.scale.x=sign;const shape=new THREE.Shape();shape.moveTo(0,0);shape.lineTo(.92,.34);shape.lineTo(1.1,.02);shape.lineTo(.84,-.06);shape.lineTo(.94,-.44);shape.lineTo(.55,-.28);shape.lineTo(.5,-.61);shape.lineTo(.21,-.3);shape.lineTo(0,-.2);shape.closePath();const membrane=this.mesh(wing,this.geometry('dragon-wing',()=>new THREE.ExtrudeGeometry(shape,{depth:.025,bevelEnabled:false})),'violet',side,0,0,0);membrane.rotation.x=Math.PI/2;this.rod(wing,'scaleDark',side,new THREE.Vector3(0,0,0),new THREE.Vector3(.94,-.02,-.34),.025);wings.push(wing);}
  const extraLegs:THREE.Group[]=[];for(const x of [-.24,.24])for(const z of [-.28,.27]){const leg=this.joint(body,x,.43,z,'claw-leg');this.cylinder(leg,'scaleDark',side,0,-.14,0,.065,.28);this.box(leg,'bone',side,0,-.29,-.045,.12,.05,.2);extraLegs.push(leg);}
  return {head,wings,tail,extraLegs};
 }
 private horse(body:THREE.Group,side:Side):Parts{
  this.ball(body,'leather',side,0,.62,0,.34,.3,.62);this.box(body,'team',side,0,.83,.1,.68,.15,.55);this.box(body,'gold',side,0,.86,.1,.05,.16,.6);
  const head=this.joint(body,0,1.0,-.58,'horse-head');const neck=this.box(head,'leather',side,0,-.09,.08,.28,.5,.25);neck.rotation.x=-.3;this.box(head,'leather',side,0,.15,-.13,.27,.27,.46);this.box(head,'bone',side,0,.09,-.37,.28,.12,.07);for(const sign of [-1,1]){this.cone(head,'leather',side,sign*.09,.4,-.04,.05,.18);this.ball(head,'eye',side,sign*.14,.18,-.19,.025,.03,.03);}
  const extraLegs:THREE.Group[]=[];for(const x of [-.24,.24])for(const z of [-.37,.37]){const leg=this.joint(body,x,.55,z,'horse-leg');this.box(leg,'leather',side,0,-.23,0,.13,.46,.14);this.box(leg,'steelDark',side,0,-.48,-.03,.16,.1,.22);extraLegs.push(leg);}
  const tail=this.joint(body,0,.67,.55,'tail');this.cone(tail,'steelDark',side,0,-.14,.15,.12,.45).rotation.x=-.6;
  const rider=this.joint(body,0,.86,.08,'mounted-rider');rider.scale.setScalar(.67);const parts=this.humanoid(rider,side,'knight');if(parts.leftLeg)parts.leftLeg.rotation.z=.4;if(parts.rightLeg)parts.rightLeg.rotation.z=-.4;
  return {...parts,head,extraLegs,tail,leftLeg:undefined,rightLeg:undefined};
 }
 private ballista(body:THREE.Group,side:Side):Parts{
  this.box(body,'base',side,0,.14,0,1.0,.27,1.0);for(const x of [-.38,.38])for(const z of [-.36,.36])this.box(body,'wood',side,x,.42,z,.18,.6,.18);this.cylinder(body,'woodLight',side,0,.67,0,.26,.6);this.box(body,'team',side,0,.66,-.35,.38,.45,.06);this.box(body,'gold',side,0,.7,-.39,.08,.2,.04);
  const weapon=this.joint(body,0,1.1,0,'ballista-bow');this.box(weapon,'wood',side,0,0,0,.26,.2,1.1);for(const sign of [-1,1]){const arm=this.box(weapon,'woodLight',side,sign*.34,.04,-.26,.68,.12,.1);arm.rotation.y=-sign*.38;this.box(weapon,'gold',side,sign*.58,.04,-.12,.11,.15,.15);this.rod(weapon,'bone',side,new THREE.Vector3(sign*.64,.04,-.12),new THREE.Vector3(0,.04,.25),.012);}this.cylinder(weapon,'steel',side,0,.17,-.2,.026,1.1).rotation.x=Math.PI/2;this.cone(weapon,'steel',side,0,.17,-.83,.075,.2).rotation.x=-Math.PI/2;
  return {weapon,static:true};
 }
 private spirit(body:THREE.Group,side:Side,meteor=false):Parts{
  this.poly(body,meteor?'obsidian':'fire',side,0,.43,0,meteor?.43:.31,meteor?.37:.37,meteor?.43:.3);for(let i=0;i<6;i++){const angle=i*Math.PI/3;const flame=this.cone(body,i%2?'fire':'fireLight',side,Math.cos(angle)*.17,.71+(i%2)*.1,Math.sin(angle)*.17,.09,.36);flame.rotation.z=-Math.cos(angle)*.45;flame.rotation.x=Math.sin(angle)*.45;}this.box(body,'fireLight',side,-.08,.5,-.28,.09,.045,.03);this.box(body,'fireLight',side,.08,.5,-.28,.09,.045,.03);this.box(body,'eye',side,-.08,.5,-.3,.035,.03,.02);this.box(body,'eye',side,.08,.5,-.3,.035,.03,.02);
  if(meteor)for(let i=0;i<8;i++){const angle=i*.785;this.box(body,'fireLight',side,Math.cos(angle)*.34,.43+Math.sin(angle)*.22,-.19,.055,.25,.05).rotation.z=-angle;}
  return {};
 }
 /** Merge rigid pieces per material inside each articulated joint, retaining cached shared buffers. */
 private compact(parent:THREE.Group,key:string){
  const groups=parent.children.filter(child=>child instanceof THREE.Group) as THREE.Group[];
  const batches=new Map<THREE.MeshStandardMaterial,THREE.Mesh[]>();
  for(const child of parent.children)if(child instanceof THREE.Mesh&&child.material instanceof THREE.MeshStandardMaterial){const list=batches.get(child.material)||[];list.push(child);batches.set(child.material,list);}
  for(const [material,meshes] of batches){if(meshes.length<2)continue;const cacheKey=`merged:${key}:${material.color.getHex()}`;let geometry=this.geometries.get(cacheKey);
   if(!geometry){const pieces=meshes.map(mesh=>{mesh.updateMatrix();let piece=mesh.geometry.clone().applyMatrix4(mesh.matrix);if(piece.index){const flat=piece.toNonIndexed();piece.dispose();piece=flat;}return piece;});const merged=mergeGeometries(pieces,false);for(const piece of pieces)piece.dispose();if(!merged)continue;geometry=merged;this.geometries.set(cacheKey,geometry);}
   for(const mesh of meshes)parent.remove(mesh);const combined=new THREE.Mesh(geometry,material);combined.castShadow=true;combined.receiveShadow=true;combined.userData.detail=meshes.every(mesh=>mesh.userData.detail===true);combined.name='rigid:'+material.color.getHexString();parent.add(combined);
  }
  groups.forEach((group,index)=>this.compact(group,`${key}/${index}:${group.name}`));
 }
 private rig(root:THREE.Group,body:THREE.Group,parts:Parts):ModelRig{
  const baseY=body.position.y,bodyScale=body.scale.clone(),armBases=[parts.leftArm?.rotation.clone(),parts.rightArm?.rotation.clone()],weaponBase=parts.weapon?.position.clone(),wingBases=parts.wings?.map(w=>w.rotation.clone());
  return {root,body,...parts,animate:pose=>{
   const {time,moving,reducedMotion}=pose,attack=Math.max(0,Math.min(1,pose.attack)),hit=Math.max(0,Math.min(1,pose.hit)),death=Math.max(0,Math.min(1,pose.death));
   const stride=reducedMotion?0:Math.sin(time*9)*(moving?.52:0),breath=reducedMotion?0:Math.sin(time*2)*.012;
   body.position.y=baseY+(parts.static?0:breath+(moving&&!reducedMotion?Math.abs(Math.sin(time*9))*.035:0));body.rotation.x=(reducedMotion?0:-attack*.12+hit*.14);body.scale.copy(bodyScale);body.scale.y*=1-hit*.07;
   if(parts.leftLeg)parts.leftLeg.rotation.x=stride;if(parts.rightLeg)parts.rightLeg.rotation.x=-stride;
   if(parts.leftArm){parts.leftArm.rotation.copy(armBases[0]!);parts.leftArm.rotation.x=-stride*.6-(reducedMotion?0:attack*.4);}
   if(parts.rightArm){parts.rightArm.rotation.copy(armBases[1]!);parts.rightArm.rotation.x=stride*.6-(reducedMotion?0:attack*1.6);parts.rightArm.rotation.z=-(reducedMotion?0:attack*.25);}
   if(parts.head){parts.head.rotation.x=reducedMotion?0:-attack*.1;parts.head.rotation.y=reducedMotion?0:Math.sin(time*1.2)*.025;}
   parts.extraLegs?.forEach((leg,i)=>{leg.rotation.x=reducedMotion?0:Math.sin(time*9+(i%2)*Math.PI)*(moving?.6:0);});
   parts.wings?.forEach((wing,i)=>{wing.rotation.copy(wingBases![i]);wing.rotation.z=reducedMotion?0:Math.sin(time*7)*(i===0?1:-1)*.35;});
   if(parts.tail)parts.tail.rotation.y=reducedMotion?0:Math.sin(time*4)*.16;
   if(parts.static&&parts.weapon&&weaponBase)parts.weapon.position.z=weaponBase.z+(reducedMotion?0:attack*.18);
   root.rotation.z=reducedMotion?0:death*1.2;root.scale.setScalar(Math.max(.1,1-death*.7));root.visible=death<1;
  }};
 }
 createUnit(card:CardId,side:Side):ModelRig{
  if(this.disposed)throw Error('Model workshop disposed.');const root=new THREE.Group(),body=this.joint(root,0,0,0,'body');root.name='unit:'+card+':'+side;let parts:Parts;
  if(card==='dragon')parts=this.dragon(body,side);else if(card==='rider')parts=this.horse(body,side);else if(card==='ballista')parts=this.ballista(body,side);else if(card==='ember'||card==='fireball'||card==='meteor')parts=this.spirit(body,side,card==='meteor');else parts=this.humanoid(body,side,card);
  if(card==='giant')body.scale.set(1.7,1.6,1.65);else if(card==='sentinel')body.scale.set(1.13,1.12,1.1);else if(card==='skeletons')body.scale.setScalar(.74);else if(card==='spears')body.scale.setScalar(.82);else if(card==='archers'||card==='hunters')body.scale.setScalar(.9);
  this.compact(body,'unit:'+card);const rig=this.rig(root,body,parts);root.userData.modelCard=card;return rig;
 }
 createTower(kind:'king'|'guard',side:Side):ModelRig{
  if(this.disposed)throw Error('Model workshop disposed.');const root=new THREE.Group(),body=this.joint(root,0,0,0,'tower-body');root.name='tower:'+kind+':'+side;
  const king=kind==='king',radius=king?1.12:.86;this.cylinder(body,'base',side,0,.15,0,radius+.18,.3);this.cylinder(body,'stone',side,0,king?1.13:.94,0,radius,king?1.85:1.55,radius*.9);this.cylinder(body,'gold',side,0,.34,0,radius+.04,.1);
  const top=king?2.05:1.72;this.cylinder(body,'steelDark',side,0,top,0,radius+.06,.16);for(let i=0;i<8;i++){const angle=i*Math.PI/4;const block=this.box(body,'stone',side,Math.sin(angle)*(radius-.1),top+.18,Math.cos(angle)*(radius-.1),.3,.4,.25);block.rotation.y=angle;}
  this.cone(body,'team',side,0,top+.47,0,radius*.82,.8);this.cylinder(body,'gold',side,0,top+.08,0,radius*.85,.09);this.box(body,'eye',side,0,.86,-radius*.96,.42,.72,.08);this.cone(body,'eye',side,0,1.28,-radius*.96,.24,.22).rotation.x=Math.PI/2;this.box(body,'wood',side,0,.64,-radius-0.02,.32,.31,.04);this.box(body,'gold',side,0,.68,-radius-.05,.035,.32,.025);
  for(const sign of [-1,1]){this.box(body,'team',side,sign*radius*.65,1.04,-radius*.72,.25,.64,.04);this.cone(body,'team',side,sign*radius*.65,.64,-radius*.72,.145,.2).rotation.z=Math.PI;}
  const weapon=this.joint(body,0,top+.15,-radius*.6,'tower-weapon');this.cylinder(weapon,'steelDark',side,0,.09,-.24,.11,.55).rotation.x=Math.PI/2;this.cylinder(weapon,'gold',side,0,.09,-.52,.13,.07).rotation.x=Math.PI/2;
  if(king){for(const x of [-.81,.81])for(const z of [-.7,.7]){this.cylinder(body,'stone',side,x,1.2,z,.26,1.5);this.cone(body,'team',side,x,2.04,z,.34,.55);this.box(body,'eye',side,x,1.5,z-.25,.1,.21,.035);}const flag=this.joint(body,0,top+1.07,0,'flag');this.cylinder(flag,'gold',side,0,.23,0,.025,.72);this.box(flag,'team',side,.23,.42,0,.45,.25,.035);this.box(flag,'gold',side,.24,.42,-.025,.07,.15,.015);}
  else{this.cylinder(body,'gold',side,.36,top+.79,.03,.02,.66);this.box(body,'teamLight',side,.52,top+.98,.03,.3,.18,.025);}
  this.compact(body,'tower:'+kind);return this.rig(root,body,{weapon,static:true});
 }
 /** Only once after every model has been detached from the scene. */
 dispose(){if(this.disposed)return;this.disposed=true;for(const geometry of this.geometries.values())geometry.dispose();for(const material of this.materials.values())material.dispose();this.geometries.clear();this.materials.clear();}
 get resourceCounts(){return {geometries:this.geometries.size,materials:this.materials.size,disposed:this.disposed};}
}
