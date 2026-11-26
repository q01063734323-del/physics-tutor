import * as T from 'three';

const vertexShader = `
 varying vec3 vPoint;
 uniform vec3 uEye;
 void main() {
  vPoint=position;
  gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);
 }
`;

const fragmentShader = `
 varying vec3 vPoint;
 uniform vec3 uEye;

 float puff(vec3 p, vec3 center, vec3 stretch) {
  return max(0.,1.-length((p-center)*stretch));
 }
 float density(vec3 p) {
  return max(
   puff(p,vec3(-.25,0.,0.),vec3(1.50,1.44,1.28)),
   max(puff(p,vec3(.28,.12,.08),vec3(1.47,1.30,1.36)),
       puff(p,vec3(.09,-.22,-.15),vec3(1.32,1.88,1.57)))
  );
 }
 void main() {
  vec3 direction=normalize(vPoint-uEye);
  vec3 first=(-vec3(1.)-uEye)/direction;
  vec3 last=(vec3(1.)-uEye)/direction;
  vec3 ends=min(first,last);
  float near=max(max(ends.x,ends.y),ends.z);
  float stepLength=(distance(vPoint,uEye)-max(0.,near))/10.;
  vec3 color=vec3(0.);
  float alpha=0.;
  for(int i=0;i<10;i++){
   vec3 p=uEye+direction*(near+(float(i)+.55)*stepLength);
   float d=density(p);
   float ripple=.89+.11*sin(p.x*28.+sin(p.z*17.))*sin(p.y*28.+p.z*12.);
   float a=(1.-alpha)*d*ripple*stepLength*.54;
   vec3 ink=mix(vec3(.24,.36,.68),vec3(.98,.80,.79),clamp(.46+p.y*.67+p.x*.16,0.,1.));
   color+=ink*a;
   alpha+=a;
  }
  gl_FragColor=vec4(color/max(alpha,.001),alpha);
  #include <colorspace_fragment>
 }
`;

export function makeCloudVolume() {
 return new T.Mesh(new T.BoxGeometry(2,2,2), new T.ShaderMaterial({
  vertexShader,fragmentShader,uniforms:{uEye:{value:new T.Vector3()}},
  side:T.BackSide,transparent:true,depthWrite:false,
 }));
}
