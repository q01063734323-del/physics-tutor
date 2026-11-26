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
 float hash(vec2 a){return fract(sin(dot(a,vec2(127.1,311.7)))*43758.5453);}
 float n(vec2 x){
  vec2 i=floor(x),f=fract(x);
  f=f*f*(3.-2.*f);
  return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+1.),f.x),f.y);
 }
 void main() {
  float x=vUv.x,y=vUv.y;
  float clock=uTime*(1.02+.035*uSeed);
  float wander=n(vec2(x*5.+uSeed,y*8.-clock*.28));
  float wide=n(vec2(x*10.+wander*.68,y*5.-clock*1.75));
  float small=n(vec2(x*29.+wander*1.9,y*10.-clock*2.9));
  float lines=pow(.5+.5*sin(x*102.+5.*n(vec2(x*7.,y*13.-clock*3.))),6.);
  float coarse=n(vec2(x*6.+uSeed,y*1.6-clock*.48));
  float film=smoothstep(.26,.78,wide*.78+small*.23);
  float turbulence=n(vec2(x*19.+uSeed,y*31.-clock*4.));
  float lace=smoothstep(.61,.86,small*.63+turbulence*.37);
  float crest=clamp(pow(max(0.,small),3.)*1.70+lines*.28+lace*.46,0.,1.);
  float water=mix(.30,.82,film);
  float translucent=(1.-smoothstep(.71,1.,y))*(smoothstep(.0,.09,x)*(1.-smoothstep(.92,1.,x)));
  translucent*=mix(.64,1.,coarse);
  float angle=abs(dot(normalize(vEye),normalize(vNormal)));
  float highlight=pow(1.-clamp(angle,.0,1.),2.0)*.75;
  vec3 blue=mix(vec3(.016,.12,.34),vec3(.067,.49,.83),water);
  vec3 ice=mix(vec3(.39,.83,.94),vec3(1.0,.87,.68),highlight*.4);
  vec3 color=mix(blue,ice,clamp(crest*.85+highlight*.15,0.,1.));
  float lipFoam=(1.-smoothstep(.025,.13,y))*smoothstep(.42,.76,wide*.77+turbulence*.23);
  color=mix(color,vec3(.78,.94,1.),lipFoam*.66);
  if(uFlat>.5){
   color=mix(color,ice,pow(.5+.5*sin(x*44.+12.*y-clock*5.+6.*wide),11.)*.30);
   translucent=max(.52,translucent);
  }
  gl_FragColor=vec4(color,translucent*(uLayer<.5?.91:(.26+.37*film)));
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

export function makeKingdomWater(sites:WaterSite[], cloud:T.Texture, low:boolean, high:boolean){
 const root=new T.Group(), materials:T.ShaderMaterial[]=[];
 const mist:T.Sprite[]=[];
 const drops:number[]=[],dropAttrs:number[]=[];
 sites.forEach(([x,y,z,width,height,angle],index)=>{
  const zone=new T.Group();
  zone.position.set(x,z,-y);
  zone.rotation.y=angle;
  root.add(zone);
  const layers=low?1:high?3:2;
  for(let k=0;k<=layers;k++){
   const flat=k===layers;
   const material=new T.ShaderMaterial({
    transparent:true,depthWrite:false,side:T.DoubleSide,
    uniforms:{uTime:{value:0},uSeed:{value:index+1.7*k},uLayer:{value:flat?0:k},uFlat:{value:flat?1:0}},
    vertexShader:vertex,fragmentShader:fragment,
   });
   const mesh=new T.Mesh(flat?pool(width):ribbon(width,height,k===1?-.83:.87,k,low),material);
   mesh.renderOrder=flat?7:9+k;materials.push(material);zone.add(mesh);
  }
  for(let i=0;i<(low?1:3);i++){
   const vapor=new T.Sprite(new T.SpriteMaterial({map:cloud,color:i===0?0xd8e8fc:0xafcee7,
    depthWrite:false,transparent:true,opacity:.40/(i===0?1:1.4)}));
   const bottom=-height*.98+i*.14;
   vapor.position.set((i-1)*width*.28,bottom,.66+i*.11);
   vapor.scale.set(width*(1.8+i*.24),.62+i*.2,1);
   vapor.userData.bottom=bottom;
   vapor.renderOrder=14;zone.add(vapor);mist.push(vapor);
  }
  for(let i=0;i<(low?12:high?43:28);i++){
   const ratio=i*.6180339%1;
   drops.push(x+(ratio-.5)*width*1.16,z-height*.97+.08*Math.sin(i),-y+.59+Math.sin(i*1.77)*.22);
   dropAttrs.push(ratio,34+(i*13%59),i*.117%1,i*.349%1);
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
    m.material.opacity=.32+.09*Math.sin(time*.64+i);
   });
  },
  dispose(){
   geometry.dispose();spray.material.dispose();
   mist.forEach(sprite=>sprite.material.dispose());
  },
 };
}
