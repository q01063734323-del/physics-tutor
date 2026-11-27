import * as T from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

type Tier = 'ultra' | 'high' | 'medium' | 'low';
type Point = [number,number,number];
const TAU=Math.PI*2;

function atlas(size:number, type:'stone'|'glass'|'wood') {
 const canvas=document.createElement('canvas');canvas.width=canvas.height=size;
 const ctx=canvas.getContext('2d')!;
 let seed=2593;
 const rng=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
 if(type==='glass'){
  const gradient=ctx.createLinearGradient(0,0,size,size);
  gradient.addColorStop(0,'#6db8e9');gradient.addColorStop(.54,'#2245a0');gradient.addColorStop(1,'#553c89');
  ctx.fillStyle=gradient;ctx.fillRect(0,0,size,size);
  const colors=['#3b63b6','#6399d5','#8ecfea','#234b94','#578ccf','#534791','#8668ac','#adcde7'];
  ctx.lineWidth=size*.008;ctx.strokeStyle='#102751';
  for(let y=0;y<9;y++)for(let x=0;x<5;x++){
   ctx.beginPath();
   const px=(x+(y%2)*.5)*size*.25,py=y*size*.13;
   ctx.moveTo(px,py-size*.105);ctx.lineTo(px+size*.126,py);ctx.lineTo(px,py+size*.105);ctx.lineTo(px-size*.126,py);
   ctx.closePath();ctx.globalAlpha=.72;
   ctx.fillStyle=colors[Math.floor(rng()*colors.length)];ctx.fill();ctx.globalAlpha=1;ctx.stroke();
  }
  for(let i=0;i<1300;i++){
   ctx.fillStyle=rng()>.5?'#bdddff32':'#12265933';ctx.fillRect(rng()*size,rng()*size,rng()*size*.015+1,1);
  }
 } else {
  const stone=type==='stone';
  ctx.fillStyle=stone?'#b0a9a7':'#815635';ctx.fillRect(0,0,size,size);
  for(let i=0;i<size*28;i++){
   ctx.fillStyle=stone?(rng()>.47?'#1c26301a':'#fff4e425'):(rng()>.45?'#23131a29':'#ffe4ad20');
   ctx.fillRect(rng()*size,rng()*size,stone?rng()*4+1:rng()*size*.3,rng()*2+1);
  }
  for(let i=0;i<55;i++){
   let x=rng()*size,y=rng()*size;
   ctx.strokeStyle=stone?'#5b63745c':'#311c1c5c';ctx.lineWidth=.6+rng()*1.9;ctx.beginPath();ctx.moveTo(x,y);
   for(let j=0;j<5;j++){x+=rng()*size*.036;y+=(rng()-.5)*size*(stone?.08:.013);ctx.lineTo(x,y);}
   ctx.stroke();
  }
 }
 const map=new T.CanvasTexture(canvas);map.colorSpace=T.SRGBColorSpace;map.anisotropy=size>128?4:1;
 return map;
}

function gothic(width:number,height:number,bottom:number,z:number,x:number):Point[]{
 const points:Point[]=[[x-width/2,bottom,z],[x-width/2,bottom+height*.62,z]];
 for(let i=1;i<=14;i++){
  const t=i/14;
  points.push([x-width/2+(width/2)*t*t,bottom+height*(.62+.38*t),z]);
 }
 for(let i=13;i>=0;i--){
  const t=i/14;
  points.push([x+width/2-(width/2)*t*t,bottom+height*(.62+.38*t),z]);
 }
 points.push([x+width/2,bottom,z]);
 return points;
}

function pointedGlass(points:Point[],width:number,height:number,bottom:number,x:number){
 const shape=new T.Shape();
 points.forEach(([px,py],i)=>i?shape.lineTo(px,py):shape.moveTo(px,py));
 shape.closePath();
 const mesh=new T.ShapeGeometry(shape);
 const pos=mesh.getAttribute('position'),uv=mesh.getAttribute('uv');
 for(let i=0;i<pos.count;i++)uv.setXY(i,(pos.getX(i)-x)/width+.5,(pos.getY(i)-bottom)/height);
 return mesh.translate(0,0,points[0][2]);
}

export function makeScienceHall(tier:Tier){
 const low=tier==='low', ultra=tier==='ultra', high=ultra||tier==='high';
 const root=new T.Group(), glass=atlas(low?128:ultra?512:256,'glass'), stone=atlas(low?128:256,'stone'), wood=atlas(low?128:256,'wood');
 const masonry=new T.MeshStandardMaterial({color:0x5b6483,map:stone,roughness:.89,vertexColors:true});
 const trim=new T.MeshStandardMaterial({color:0xb8a796,map:stone,roughness:.66,vertexColors:true});
 const marble=new T.MeshStandardMaterial({color:0x3b4b68,map:stone,bumpMap:stone,bumpScale:.014,roughness:.39,metalness:.28});
 const gold=new T.MeshStandardMaterial({color:0xe5a64d,metalness:.79,roughness:.31});
 const iron=new T.MeshStandardMaterial({color:0x213958,metalness:.62,roughness:.42});
 const oak=new T.MeshStandardMaterial({color:0x60391f,map:wood,roughness:.67});
 const amber=new T.MeshBasicMaterial({color:0xffc674});
 const azure=new T.MeshStandardMaterial({color:0x4ba1db,metalness:.33,roughness:.25,emissive:0x277de2,emissiveIntensity:.58,flatShading:true});
 const windowMaterial=new T.MeshBasicMaterial({map:glass,color:0x9fbce8});
 const patches=new Map<T.Material,T.BufferGeometry[]>();
 function add(geometry:T.BufferGeometry,material:T.Material,x=0,y=0,z=0){
  geometry.translate(x,y,z);
  const part=geometry.index?geometry.toNonIndexed():geometry;
  if(part!==geometry)geometry.dispose();
  if(material===masonry||material===trim){
   const pos=part.getAttribute('position'), normal=part.getAttribute('normal'),colors=new Float32Array(pos.count*3);
   const block=.67+(.33*(.5+.5*Math.sin(x*29.1+y*13.3+z*8.9)));
   for(let i=0;i<pos.count;i++){
    const xx=pos.getX(i),yy=pos.getY(i),zz=pos.getZ(i);
    const windows=Math.exp(-((xx-2.3)*(xx-2.3)*.04+(zz+6.45)*(zz+6.45)*.22));
    const golden=Math.exp(-((Math.abs(xx)-3.15)**2+(yy-2.12)**2+(zz+4.25)**2)*.40);
    const floor=Math.min(1,Math.max(.56,.58+yy*.17));
    const face=.8+Math.max(normal.getY(i),-.38)*.20;
    colors.set([block*floor*face*(.70+.35*golden),block*floor*face*(.72+.14*windows+.11*golden),
      block*floor*face*(.80+.20*windows)],i*3);
   }
   part.setAttribute('color',new T.BufferAttribute(colors,3));
  }
  const existing=patches.get(material);
  if(existing)existing.push(part);
  else patches.set(material,[part]);
 }
 const box=(w:number,h:number,d:number,x:number,y:number,z:number,mat=masonry)=>add(new T.BoxGeometry(w,h,d),mat,x,y,z);
 const cylinder=(r:number,rr:number,h:number,x:number,y:number,z:number,mat:T.Material=trim,s=high?24:12)=>add(new T.CylinderGeometry(r,rr,h,s),mat,x,y,z);
 function tube(points:Point[],radius:number,material:T.Material,closed=false){
  const path=new T.CatmullRomCurve3(points.map(point=>new T.Vector3(...point)),closed,'centripetal');
  add(new T.TubeGeometry(path,Math.max(10,(high?3:2)*points.length),radius,high?7:5,closed),material);
 }
 function ornament(x:number,y:number,z:number,r:number,material=gold){
  for(let a=0;a<3;a++){
   const angle=a*Math.PI/3;
   const points:Point[]=Array.from({length:24},(_,i)=>{
    const q=i*TAU/24,u=Math.cos(q)*r,v=Math.sin(q)*r*.38;
    return [x+u*Math.cos(angle)-v*Math.sin(angle),y+u*Math.sin(angle)+v*Math.cos(angle),z];
   });
   tube(points,r*.028,material,true);
  }
 }
 // The floor is laid in alternating stone with brass lines and a central inlaid compass.
 box(27,.22,22,0,-.15,-2,marble);
 const tiles=new T.InstancedMesh(new T.BoxGeometry(1.17,.065,1.17),marble,17*14);
 const dummy=new T.Object3D(), color=new T.Color();
 for(let i=0;i<tiles.count;i++){
  const x=i%17-8,z=Math.floor(i/17)-8;
  dummy.position.set(x*1.19,-.029,z*1.19);
  dummy.updateMatrix();tiles.setMatrixAt(i,dummy.matrix);
  tiles.setColorAt(i,color.set((x+z)%2?0xaaaaa6:0x6d86bb).multiplyScalar(.56+(.04*(i*7%11))));
 }
 tiles.receiveShadow=high; root.add(tiles);
 for(const x of [-4.85,4.85,-2.18,2.18])box(.025,.009,19,x,.007,-2,gold);
 for(const r of [2.13,2.27,3.47]){
  const edge=new T.TorusGeometry(r,.015,5,high?96:48).rotateX(-Math.PI/2);
  add(edge,gold,0,.012,.06);
 }
 const darkWall=new T.MeshStandardMaterial({color:0x151f37,roughness:.96});
 box(27,9.0,.60,0,4.1,-7.66,darkWall);
 for(const x of [-10.72,10.72])box(.58,8.4,18,x,4,-.1,darkWall);
 // Both balconies and the wall below the windows have open mortar seams.
 for(let y=0;y<19;y++)for(let x=0;x<18;x++){
  const px=(x-8.5)*1.35+(y%2)*.55,py=.3+y*.46;
  if(y>1&&[-7.3,-3.73,0,3.73,7.3].some(pos=>Math.abs(px-pos)<1.17&&py<6.00))continue;
  box(1.313,.423,.32,px,py,-7.25+Math.sin(x*3+y)*.053,masonry);
 }
 for(const [i,x] of [-7.3,-3.73,0,3.73,7.3].entries()){
  const h=i===2?5.32:4.86,bottom=.91;
  add(pointedGlass(gothic(2.26,h,bottom,-7.02,x),2.26,h,bottom,x),windowMaterial);
  for(const [w,offset,r,m] of [[2.50,.08,.139,trim],[2.24,.17,.061,iron],[2.54,.22,.025,gold]] as const){
   tube(gothic(w,h+.115,bottom,-7.0+offset,x),r,m);
  }
  for(const shift of [-.385,.385]){
   box(.056,h*.738,.12,x+shift,bottom+h*.364,-6.80,iron);
   tube(gothic(.72,h*.89,bottom,-6.79,x+shift),.025,trim);
  }
  for(const y of [bottom,bottom+h*.22,bottom+h*.47])box(2.19,.044,.16,x,y,-6.80,iron);
  box(2.68,.16,.53,x,bottom-.09,-6.87,trim);
  ornament(x,bottom+h*.75,-6.72,.43);
  const rose=new T.CircleGeometry(.49,32).translate(x,bottom+h*.739,-6.96);
  add(rose,windowMaterial);
  const tracer=new T.TorusGeometry(.49,.028,6,32);
  add(tracer,gold,x,bottom+h*.739,-6.71);
  for(let j=0;j<8;j++){
   const a=j*TAU/8;
   add(new T.TorusGeometry(.115,.012,4,20),trim,x+.33*Math.cos(a),bottom+h*.739+.33*Math.sin(a),-6.72);
  }
 }
 for(const z of [-6.38,-3.01,.28]){
  for(const x of [-9.15,-5.56,5.56,9.15]){
   cylinder(.47,.55,.33,x,.17,z,masonry,8);
   cylinder(.45,.49,.14,x,.4,z,trim,12);
   cylinder(.27,.33,6.8,x,3.86,z,masonry);
   for(let i=0;i<6;i++){
    const a=i*TAU/6;
    cylinder(.053,.068,6.55,x+Math.cos(a)*.255,3.82,z+Math.sin(a)*.255,trim,6);
   }
   for(const [y,r,material] of [[.53,.37,gold],[1.05,.35,trim],[2.89,.302,gold],[6.98,.46,trim],[7.06,.48,gold],[7.17,.51,trim]] as const){
    cylinder(r,r+.026,.11,x,y,z,material,12);
   }
  }
  for(const radius of [.102,.054]){
   const points:Point[]=Array.from({length:27},(_,i)=>{
    const q=i/26*2-1;
    return [q*5.49,6.93+2.15*(1-Math.abs(q)**1.65),z+(radius>.07?0:.13)];
   });
   tube(points,radius,radius>.07?trim:gold);
  }
 }
 // Longitudinal ribs connect the transverse arches into a vaulted ceiling.
 for(const side of [-1,1]){
  for(const x of [2.3,4.7]){
   const altitude=6.93+2.15*(1-(x/5.49)**1.65);
   tube([[side*x,altitude,-6.38],[side*x,altitude+.10,-3.01],[side*x,altitude,.28]],.067,trim);
  }
  for(const z of [-6.38,-3.01,.28]){
   const x=side*5.56;
   box(.86,.13,.83,x,7.23,z,trim);
   ornament(x,6.61,z+.36,.20,gold);
  }
 }
 for(const z of [-6.38,-3.01,.28]){
  add(new T.IcosahedronGeometry(.20,1).scale(1,.67,1),gold,0,8.95,z);
 }
 for(const side of [-1,1]){
  const x=side*3.2,z=-5.95;
  box(1.28,.15,.44,x,.23,z,oak);
  for(let shelf=0;shelf<4;shelf++){
   box(1.42,.078,.45,x,.39+shelf*.44,z,oak);
   box(1.40,.035,.040,x,.425+shelf*.44,z+.226,gold);
  }
  for(const a of [-.68,.68])box(.105,1.89,.46,x+a,1.19,z,oak);
  cylinder(.24,.39,.20,side*4.0,.56,-2.25,gold);
  cylinder(.10,.22,.84,side*4.0,1.04,-2.25,oak);
  cylinder(.40,.44,.13,side*4.0,1.49,-2.25,gold);
  add(new T.OctahedronGeometry(.31,0).scale(.74,1.59,.74).rotateZ(.23),azure,side*4.0,1.98,-2.25);
  for(const y of [.21,1.35,1.56])cylinder(.32,.36,.085,side*4.0,y,-2.25,marble);
 }
 const books=new T.InstancedMesh(new T.BoxGeometry(.11,.31,.29),oak,low?48:80);
 for(let i=0;i<books.count;i++){
  const side=i%2?1:-1, shelf=Math.floor(i/20)%4, k=Math.floor(i/2)%10;
  dummy.position.set(side*3.2+(k-4.5)*.12,.577+.44*shelf,-5.86);
  dummy.scale.set(.89, .56+(i*11%19)*.030,1);
  dummy.rotation.z=(i%7-3)*.045;dummy.updateMatrix();books.setMatrixAt(i,dummy.matrix);
  books.setColorAt(i,color.set([0xc57349,0x687ec1,0x767e51,0xdd9c55,0x859daa][i%5]));
 }
 root.add(books);
 // Orrery and optics occupy the edges of the stage without obscuring a full party.
 for(const [side,x,z] of [[-1,-2.64,-1.3],[1,2.72,-2.1]] as const){
  const pedestal=new T.LatheGeometry([new T.Vector2(.39,0),new T.Vector2(.43,.1),new T.Vector2(.29,.24),new T.Vector2(.22,.64),
   new T.Vector2(.35,.75),new T.Vector2(.40,.8),new T.Vector2(.34,.93)],high?28:14);
  add(pedestal,marble,x,.015,z);
  for(const y of [.11,.24,.64,.80])add(new T.TorusGeometry(y>.6?.337:.353,.024,6,28).rotateX(-Math.PI/2),gold,x,y,z);
  if(side<0){
   const barrel=new T.CylinderGeometry(.118,.083,1.18,high?20:12).rotateZ(-1.10);
   add(barrel,oak,x,1.47,z);
   for(const k of [-.51,-.23,.22,.53]){
    const collar=new T.CylinderGeometry(.122,.134,.063,16).rotateZ(-1.1);
    add(collar,gold,x+Math.sin(1.10)*k,1.47+Math.cos(1.10)*k,z);
   }
   add(new T.CircleGeometry(.096,20).rotateY(1.77),azure,x+.562,1.76,z);
   for(let leg=0;leg<3;leg++){
    const a=leg*TAU/3;
    tube([[x,1.42,z],[x+.11*Math.cos(a),1.07,z+.11*Math.sin(a)],[x+.28*Math.cos(a),.80,z+.28*Math.sin(a)]],.023,gold);
   }
  }else{
   cylinder(.18,.26,.28,x,.99,z,gold,16);
   for(let j=0;j<8;j++){
    const height=1.09+j*.075;
    add(new T.TorusGeometry(.19-.007*j,.033,6,31).rotateX(-Math.PI/2),gold,x,height,z);
   }
   const bulb=new T.SphereGeometry(.30,high?24:12,high?16:9).scale(.94,1.11,.94);
   const curvedGlass=new T.MeshStandardMaterial({color:0x7dbaf8,metalness:.52,roughness:.17,transparent:true,opacity:.35,depthWrite:false});
   add(bulb,curvedGlass,x,1.83,z);
   add(new T.IcosahedronGeometry(.14,1),azure,x,1.81,z);
   for(let j=0;j<3;j++)add(new T.TorusGeometry(.31,.013,5,38).rotateX(j*.94+.5).rotateZ(j*1.08),gold,x,1.81,z);
  }
 }
 const atom=new T.Group();
 for(let i=0;i<3;i++){
  const orbit=new T.Mesh(new T.TorusGeometry(1,.033,7,64),gold);
  orbit.rotation.set(i*1.047+.3,.6+i*.33,-.55*i);orbit.scale.x=1.44;atom.add(orbit);
 }
 const nucleus=new T.Mesh(new T.IcosahedronGeometry(.17,1),azure);atom.add(nucleus);atom.position.set(-2.72,4.27,-3.85);root.add(atom);
 const lanterns:Point[]=[[-5.35,2.8,-3],[5.35,2.8,-3],[-2.51,2.22,-4.4],[2.51,2.22,-4.4]];
 for(const [x,y,z] of lanterns){
  cylinder(.15,.24,.065,x,y-.20,z,gold,8);
  cylinder(.112,.126,.29,x,y,z,amber,8);
  cylinder(.085,.19,.087,x,y+.185,z,gold,8);
  for(let k=0;k<4;k++){
   const a=(k+.5)*TAU/4;
   box(.022,.35,.022,x+Math.cos(a)*.14,y,z+Math.sin(a)*.14,gold);
  }
 }
 const flagMaterial=new T.MeshStandardMaterial({color:0x18366f,roughness:.86,side:T.DoubleSide});
 const wind={value:0};
 flagMaterial.onBeforeCompile=shader=>{
  shader.uniforms.hallBreeze=wind;
  shader.vertexShader='uniform float hallBreeze;\n'+shader.vertexShader;
  shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`
   #include <begin_vertex>
   transformed.z+=sin(position.x*7.+hallBreeze*2.)*uv.y*uv.y*.065;
  `);
 };
 const flagCanvas=document.createElement('canvas');flagCanvas.width=192;flagCanvas.height=384;
 const ink=flagCanvas.getContext('2d')!;
 const blue=ink.createLinearGradient(0,0,192,0);blue.addColorStop(0,'#132449');blue.addColorStop(.45,'#3761ac');blue.addColorStop(1,'#182144');
 ink.beginPath();ink.moveTo(4,2);ink.lineTo(188,2);ink.lineTo(188,325);ink.lineTo(96,376);ink.lineTo(4,325);ink.closePath();
 ink.fillStyle=blue;ink.fill();ink.lineWidth=7;ink.strokeStyle='#d5a456';ink.stroke();
 for(let i=0;i<3;i++){ink.beginPath();ink.ellipse(96,178,59,21,i*Math.PI/3,0,TAU);ink.stroke();}
 ink.beginPath();ink.arc(96,178,7,0,TAU);ink.fillStyle='#ffd48e';ink.fill();
 flagMaterial.map=new T.CanvasTexture(flagCanvas);flagMaterial.map.colorSpace=T.SRGBColorSpace;flagMaterial.alphaTest=.43;flagMaterial.color.setHex(0xdadff4);
 for(const x of [-2.38,2.38,-6.1,6.1]){
  const flag=new T.Mesh(new T.PlaneGeometry(.89,1.82,low?7:16,12),flagMaterial);
  flag.position.set(x,4.14,-6.78);root.add(flag);
  tube([[x-.55,5.06,-6.72],[x,5.06,-6.72],[x+.55,5.06,-6.72]],.028,gold);
 }
 // Ivy is a single instanced batch of folded leaves following six wall-side runners.
 const leaf=new T.BufferGeometry();
 leaf.setAttribute('position',new T.Float32BufferAttribute([0,0,0,-.11,.09,0,0,.16,.037,0,.16,.037,-.11,.09,0,0,.25,0,0,.16,.037,0,.25,0,.125,.093,0,0,0,0,0,.16,.037,.125,.093,0],3));
 leaf.computeVertexNormals();
 const leaves=new T.InstancedMesh(leaf,new T.MeshStandardMaterial({color:0xffffff,side:T.DoubleSide,roughness:.92}),low?65:high?170:110);
 for(let i=0;i<leaves.count;i++){
  const t=(i%29)/29,index=Math.floor(i/29);
  const base=[-5.62,5.51,-4.05,4.02,-1.82,1.88][index];
  dummy.position.set(base+.20*Math.sin(t*10+index)+.11*Math.cos(i*2.39),.46+t*(index<2?3.25:1.16), index<2?-2.63:-6.72);
  dummy.rotation.set(.36*Math.sin(i),.62*Math.sin(i*2.39),Math.sin(i*4.2)*1.65);
  dummy.scale.setScalar(.48+(i%7)*.12);dummy.updateMatrix();leaves.setMatrixAt(i,dummy.matrix);
  leaves.setColorAt(i,color.set([0x314f32,0x526c38,0x849653,0x49694e][i%4]));
 }
 root.add(leaves);
 for(const [material,geometries] of patches){
  const merged=mergeGeometries(geometries);
  geometries.forEach(g=>g.dispose());
  if(merged){const mesh=new T.Mesh(merged,material);mesh.receiveShadow=high; root.add(mesh);}
 }
 const glowCanvas=document.createElement('canvas');glowCanvas.width=glowCanvas.height=64;
 const painter=glowCanvas.getContext('2d')!;
 const halo=painter.createRadialGradient(32,32,1,32,32,32);
 halo.addColorStop(0,'#ffe7aa92');halo.addColorStop(.2,'#ffc26156');halo.addColorStop(1,'#f5972900');
 painter.fillStyle=halo;painter.fillRect(0,0,64,64);
 const glare=new T.CanvasTexture(glowCanvas);glare.colorSpace=T.SRGBColorSpace;
 const glow=new T.SpriteMaterial({map:glare,transparent:true,blending:T.AdditiveBlending,depthWrite:false});
 for(const [x,y,z] of lanterns){
  const bulb=new T.Sprite(glow);bulb.position.set(x,y,z+.06);bulb.scale.set(1.29,1.24,1);root.add(bulb);
  if(!low&&Math.abs(x)<4){
   const light=new T.PointLight(0xffa950,12,5.0,2);light.position.set(x,y,z+.22);root.add(light);
  }
 }
 if(high){
  const material=new T.ShaderMaterial({transparent:true,depthWrite:false,blending:T.AdditiveBlending,side:T.DoubleSide,
   vertexShader:'varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
   fragmentShader:`varying vec2 vUv;
   void main(){vec2 q=vUv;float width=.17+.19*q.y;
   float mask=(1.-smoothstep(.015,width,abs(q.x-.5)))*sin(q.y*3.14159);
   gl_FragColor=vec4(.24,.43,.86,mask*.105);}`});
  for(const x of [-3.66,0,3.74]){
   const beam=new T.Mesh(new T.PlaneGeometry(2.2,7.4),material);
   beam.position.set(x,3.72,-5);beam.rotation.z=-.42;root.add(beam);
  }
 }
 return {root,update(time:number){wind.value=time;atom.rotation.y=.33+time*.19;atom.rotation.z=.15*Math.sin(time*.65);glow.opacity=.72+Math.sin(time*3.1)*.11;},
  dispose(){tiles.dispose();books.dispose();leaves.dispose();glow.dispose();glare.dispose();}};
}
