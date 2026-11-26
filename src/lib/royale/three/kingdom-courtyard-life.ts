import * as T from 'three';

// Both effects share one batch each. Origins are beside flowerbeds and exposed crystal veins.
export function makeCourtyardLife(ultra: boolean) {
 const root=new T.Group();
 const clock={value:0};
 const flowerBeds=[[-2.85,.54,1.93],[-1.58,.47,2.44],[2.34,.42,2.18],[3.51,.51,1.38]];
 const wingGeometry=new T.BufferGeometry();
 wingGeometry.setAttribute('position',new T.Float32BufferAttribute([
  0,0,.018,-.095,.005,.07,-.067,-.006,-.04, 0,0,.018,-.067,-.006,-.04,0,0,-.024,
  0,0,.018,.067,-.006,-.04,.095,.005,.07, 0,0,.018,0,0,-.024,.067,-.006,-.04,
 ],3));
 const wingMaterial=new T.ShaderMaterial({
  side:T.DoubleSide,
  uniforms:{uTime:clock},
  vertexShader:`
    uniform float uTime;
    varying vec2 vWing;
    void main(){
     vec3 p=position;
     float flap=sin(uTime*24.+instanceMatrix[3].x*3.);
     p.y+=abs(p.x)*flap;
     p.x*=.61+.39*abs(cos(flap));
     vWing=position.xz;
     gl_Position=projectionMatrix*modelViewMatrix*instanceMatrix*vec4(p,1.);
    }
  `,
  fragmentShader:`
    varying vec2 vWing;
    void main(){
     float rim=smoothstep(.060,.088,abs(vWing.x));
     vec3 amber=mix(vec3(.30,.075,.025),vec3(1.,.63,.22),smoothstep(.004,.076,abs(vWing.x)));
     gl_FragColor=vec4(mix(amber,vec3(.33,.12,.095),rim*.64),1.);
     #include <tonemapping_fragment>
     #include <colorspace_fragment>
    }
  `,
 });
 const wings=new T.InstancedMesh(wingGeometry,wingMaterial,ultra?8:4);
 wings.frustumCulled=false;
 root.add(wings);

 const veins=[[-3.63,-.51,1.82],[3.92,-.29,1.89],[-1.69,-1.64,2.67],[3.33,-1.57,2.41]];
 const positions:number[]=[], phases:number[]=[];
 for(const [x,y,z] of veins){
  for(let i=0;i<(ultra?15:7);i++){
   const a=i*2.399;
   positions.push(x+.29*Math.cos(a),y-.27+i*.038,z+.24*Math.sin(a));
   phases.push(i*.629+x+z*.51);
  }
 }
 const dustGeometry=new T.BufferGeometry();
 dustGeometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));
 dustGeometry.setAttribute('aPhase',new T.Float32BufferAttribute(phases,1));
 const dustMaterial=new T.ShaderMaterial({
  transparent:true,depthWrite:false,blending:T.AdditiveBlending,
  uniforms:{uTime:clock},
  vertexShader:`
    uniform float uTime;
    attribute float aPhase;
    varying float vGlow;
    void main(){
     float phase=uTime*.71+aPhase;
     vec3 p=position+vec3(cos(phase)*.2,sin(phase*.55)*.18,sin(phase)*.13);
     vec4 view=modelViewMatrix*vec4(p,1.);
     gl_Position=projectionMatrix*view;
     gl_PointSize=clamp(95./-view.z,1.,5.);
     vGlow=.16+.44*pow(.5+.5*sin(uTime*1.9+aPhase*7.),2.);
    }
  `,
  fragmentShader:`
    varying float vGlow;
    void main(){
     float falloff=1.-smoothstep(.035,.46,length(gl_PointCoord-.5));
     gl_FragColor=vec4(.38,.77,1.,falloff*falloff*vGlow);
    }
  `,
 });
 const dust=new T.Points(dustGeometry,dustMaterial);
 dust.frustumCulled=false;dust.renderOrder=16;root.add(dust);
 const transform=new T.Object3D();
 return {root,update(time:number){
  clock.value=time;
  for(let i=0;i<wings.count;i++){
   const [x,y,z]=flowerBeds[i%flowerBeds.length];
   const phase=time*(.67+i*.031)+i*2.399;
   transform.position.set(x+.29*Math.sin(phase),y+.15*Math.sin(phase*1.66),z+.21*Math.cos(phase));
   transform.rotation.set(.29,phase,.28*Math.cos(phase));
   transform.updateMatrix();
   wings.setMatrixAt(i,transform.matrix);
  }
  wings.instanceMatrix.needsUpdate=true;
 },dispose(){
  wings.dispose();wingGeometry.dispose();wingMaterial.dispose();
  dustGeometry.dispose();dustMaterial.dispose();
 }};
}
