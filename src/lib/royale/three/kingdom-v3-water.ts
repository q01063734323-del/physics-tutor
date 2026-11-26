import * as T from 'three';

export type WaterSite = [number,number,number,number,number,number];

const vertex = `
 varying vec2 vUv;
 varying vec3 vEye;
 varying vec3 vNormal;
 uniform float uTime;
 uniform float uSeed;
 void main() {
  vUv=uv;
  vec3 p=position;
  float flow=sin(p.x*24.+uv.y*19.-uTime*4.2+uSeed);
  p.z+=flow*.043*smoothstep(.04,.3,uv.y)+.027*sin(uv.x*21.+uv.y*22.-uTime*3.);
  vec4 view=modelViewMatrix*vec4(p,1.);
  vEye=-view.xyz;
  vNormal=normalize(normalMatrix*normal);
  gl_Position=projectionMatrix*view;
 }
`;

const fragment = `
 varying vec2 vUv;
 varying vec3 vEye;
 varying vec3 vNormal;
 uniform float uTime;
 uniform float uLayer;
 uniform float uSeed;
 uniform float uFlat;
 uniform float uQuality;
 float hash(vec2 a){return fract(sin(dot(a,vec2(127.1,311.7)))*43758.5453);}
 float n(vec2 x){
  vec2 i=floor(x),f=fract(x);
  f=f*f*(3.-2.*f);
  return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+1.),f.x),f.y);
 }
 void main() {
  float x=vUv.x,y=vUv.y;
  float clock=uTime*(1.02+.035*uSeed), layer=uLayer*.27;
  float drift=n(vec2(x*4.+uSeed,y*4.-clock*.36));
  float speed=.80+.29*sin(x*29.+uSeed)+.16*cos(x*55.+layer*7.);
  float v=y*(.81+.28*y)-clock*speed;
  float pressure=n(vec2(x*11.+drift*.95,v*3.1+layer));
  float rivulets=n(vec2(x*25.+drift*1.5,v*6.4));
  float hairs=pow(.5+.5*sin(x*86.+rivulets*7.+layer*8.),7.);
  float volume=n(vec2(x*6.+uSeed,y*1.9-clock*.38));
  float stretched=smoothstep(.28,.83,pressure*.65+rivulets*.35);
  float aeration=n(vec2(x*21.+drift,v*17.));
  float foam=smoothstep(.61,.86,aeration*.46+rivulets*.32+pressure*.22);
  float fringe=smoothstep(0.,.065,x)*(1.-smoothstep(.934,1.,x));
  float breaks=mix(.55,1.,volume)*(1.-smoothstep(.60,1.0,y));
  float highlight=pow(1.-abs(dot(normalize(vEye),normalize(vNormal))),1.8);
  float sunSpec=pow(max(0.,dot(reflect(-normalize(vec3(.69,.55,.31)),normalize(vNormal)),normalize(vEye))),10.0);
  vec3 deep=mix(vec3(.007,.055,.134),vec3(.037,.26,.41),stretched);
  vec3 ice=mix(vec3(.57,.88,1.),vec3(1.,.89,.73),sunSpec*.63);
  float whitewater=pow(stretched,1.76)*.75+hairs*.13+foam*(.22+.36*highlight);
  float head=(1.-smoothstep(.015,.16,y))*smoothstep(.28,.70,pressure*.46+foam*.54);
  float feet=smoothstep(.57,.92,y)*smoothstep(.44,.76,rivulets*.42+aeration*.58);
  if(uQuality>2.5)whitewater+=.17*pow(.5+.5*sin(v*128.+x*11.+rivulets*8.),10.)*foam;
  vec3 color=mix(deep,ice,clamp(whitewater+highlight*.20+head*.66+feet*.39,0.,1.));
  if(uFlat>.5){
   float runout=smoothstep(.42,1.,y);
   color=mix(color,ice,runout*smoothstep(.42,.7,pressure*.55+rivulets*.45));
   breaks=mix(.67,.94,runout);
  }
  float coverage=uLayer<.5?(.84+.13*stretched):(.22+.25*stretched+.16*whitewater);
  gl_FragColor=vec4(color,breaks*fringe*coverage);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
 }
`;

function ribbon(width:number,height:number,side:number,layer:number,low:boolean){
 const count=low?7:13,steps=low?14:24;
 const g=new T.PlaneGeometry(1,1,count,steps);
 const p=g.getAttribute('position'),uv=g.getAttribute('uv');
 for(let i=0;i<p.count;i++){
  const u=uv.getX(i),v=1-uv.getY(i);
  const offset=(u-.5)*width*(.88+.31*v)*(layer===0?1:layer===1?.75:.46)+side*width*.13;
  const lip=.34*Math.min(1,v/.22)+.20*v*v;
  const belly=.17*(.5-Math.abs(u-.5));
  p.setXYZ(i,offset,-height*Math.pow(v,1.29)+.01*layer,lip+belly+.029*layer);
  uv.setY(i,v);
 }
 p.needsUpdate=true;uv.needsUpdate=true;g.computeVertexNormals();g.computeBoundingSphere();
 return g;
}
function pool(width:number){
 const g=new T.PlaneGeometry(width*.92,1.14,5,3);
 g.rotateX(-Math.PI/2);
 g.translate(0,.026,-.37);
 return g;
}

const sprayVertex=`
 attribute vec4 aDrop;
 uniform float uTime;
 varying float vAlpha;
 void main(){
  float phase=fract(uTime*(.48+aDrop.w*.58)+aDrop.x);
  vec3 p=position;
  float angle=aDrop.x*43.+aDrop.y*11.;
  float spread=phase*(.34+.46*aDrop.z);
  p.x+=cos(angle)*spread;
  p.z+=sin(angle)*spread*.62;
  p.y+=sin(phase*3.141593)*(.20+aDrop.w*.48)-phase*.41;
  vec4 view=modelViewMatrix*vec4(p,1.);
  gl_Position=projectionMatrix*view;
  gl_PointSize=clamp((1.-phase)*1.0*aDrop.y/max(.35,-view.z),1.,6.0);
  vAlpha=(1.-phase)*(.29+.68*sin(phase*3.141593));
 }
`;
const sprayFragment=`
 varying float vAlpha;
 void main(){
  float edge=1.-smoothstep(.11,.5,length(gl_PointCoord-.5));
  gl_FragColor=vec4(.77,.92,1.,edge*vAlpha*.79);
 }
`;

export function makeKingdomWater(sites:WaterSite[], cloud:T.Texture, quality: 'ultra'|'high'|'medium'|'low'){
 const low=quality==='low', high=quality==='high'||quality==='ultra', ultra=quality==='ultra';
 const root=new T.Group(), materials:T.ShaderMaterial[]=[];
 const mist:T.Sprite[]=[];
 const drops:number[]=[],dropAttrs:number[]=[];
 sites.forEach(([x,y,z,width,height,angle],index)=>{
  const zone=new T.Group();
  zone.position.set(x,z,-y);
  zone.rotation.y=angle;
  root.add(zone);
  const layers=low?1:ultra?4:high?3:2;
  for(let k=0;k<=layers;k++){
   const flat=k===layers;
   const material=new T.ShaderMaterial({
    transparent:true,depthWrite:false,side:T.DoubleSide,
    uniforms:{uTime:{value:0},uSeed:{value:index+1.7*k},uLayer:{value:flat?0:k},uFlat:{value:flat?1:0},uQuality:{value:low?0:ultra?3:high?2:1}},
    vertexShader:vertex,fragmentShader:fragment,
   });
   const mesh=new T.Mesh(flat?pool(width):ribbon(width,height,k===1?-.83:.87,k,low),material);
   mesh.renderOrder=flat?7:9+k;materials.push(material);zone.add(mesh);
  }
  for(let i=0;i<(low?1:ultra?4:3);i++){
   const vapor=new T.Sprite(new T.SpriteMaterial({map:cloud,color:i===0?0xd8e8fc:0xafcee7,
    depthWrite:false,transparent:true,opacity:.40/(i===0?1:1.4)}));
   const bottom=-height*.98+i*.14;
   vapor.position.set((i-1)*width*.28,bottom,.66+i*.11);
   vapor.scale.set(width*(1.85+i*.27),.58+i*.22,1);
   vapor.userData.bottom=bottom;
   vapor.renderOrder=14;zone.add(vapor);mist.push(vapor);
  }
  for(let i=0;i<(low?14:ultra?68:high?43:28);i++){
   const ratio=i*.6180339%1;
   drops.push(x+(ratio-.5)*width*1.16,z-height*.97+.08*Math.sin(i),-y+.59+Math.sin(i*1.77)*.22);
   dropAttrs.push(ratio,34+(i*13%59),i*.117%1,i*.349%1);
  }
  if(!low&&index<4){
   for(let i=0;i<(ultra?24:10);i++){
    const q=i*.6180339%1;
    drops.push(x+(q-.5)*width*.94,z+.024+.04*Math.sin(i),-y+.19+.10*Math.cos(i*1.7));
    dropAttrs.push(q,24+i%14,0.3, q*.58);
   }
  }
 });
 const geometry=new T.BufferGeometry();
 geometry.setAttribute('position',new T.Float32BufferAttribute(drops,3));
 geometry.setAttribute('aDrop',new T.Float32BufferAttribute(dropAttrs,4));
 const spray=new T.Points(geometry,new T.ShaderMaterial({
  transparent:true,depthWrite:false,uniforms:{uTime:{value:0}},vertexShader:sprayVertex,fragmentShader:sprayFragment,
 }));
 spray.renderOrder=15;spray.frustumCulled=false;root.add(spray);
 return {
  root,
  update(time:number){
   for(const material of materials)material.uniforms.uTime.value=time;
   spray.material.uniforms.uTime.value=time;
   mist.forEach((m,i)=>{
    m.position.y=(m.userData.bottom as number)+.16*Math.sin(time*.7+i*1.7);
    m.material.rotation=.13*Math.sin(time*.34+i);
    m.material.opacity=.35+.11*Math.sin(time*.64+i);
   });
  },
  dispose(){
   geometry.dispose();spray.material.dispose();
   mist.forEach(sprite=>sprite.material.dispose());
  },
 };
}
