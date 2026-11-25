export const ribbonVertex = /* glsl */`
uniform float time,progress,burst;
attribute vec4 shape; // angle, width, length, curl
varying vec2 tex;
void main(){
 float v=uv.y,t=uv.x*6.2831853;
 float arch=sin(3.14159*v), envelope=pow(max(.002,1.-v),.76);
 float seed=shape.x*.92;
 float rad=(.77+.38*sin(3.14159*min(1.,v*2.38)))*(1.-.79*v);
 float span=shape.y*envelope*(.67+.74*sin(3.14159*min(1.,v*1.4)));
 float a=shape.x+shape.w*(v*v+.28*arch)+.39*sin(4.7*v+seed+time*3.1)*arch;
 a+=cos(t)*span/max(.22,rad);
 rad+=span*(.50*sin(t)+.114*sin(2.*t+seed)*arch);
 float drift=1.07*v*v+.51*sin(4.2*v+seed+time*2.3)*arch;
 vec3 point=vec3(cos(a)*rad+drift,
  sin(a)*rad+.30*sin(v*4.5+seed+time*2.8)*arch,
  -.22+shape.z*v*(1.+.13*progress)+.19*sin(6.28318*v+seed+time*3.2)*arch+.17*cos(t)*(1.-v));
 tex=vec2(.5+.5*cos(t),v);
 if(burst>0.){
  float spread=shape.z*v*(.35+.48*fract(shape.x*.83));
  point=vec3(cos(a)*(rad+spread),max(0.,point.z)*(.55+.61*sin(shape.x*2.13)*sin(shape.x*2.13)),
             sin(a)*(rad+spread));
 }
 gl_Position=projectionMatrix*modelViewMatrix*vec4(point,1.);
}`;
export const ribbonFragment = /* glsl */`
uniform sampler2D atlas;
uniform float time,fade,heat;
varying vec2 tex;
void main(){
 vec2 p=tex;
 p.x+= .033*sin(p.y*26.-time*9.)*sin(p.y*3.14159);
 vec4 sampleA=texture2D(atlas,clamp(p,0.,1.));
 float shimmer=.82+.18*sin(time*8.-p.y*31.+p.x*4.);
 // Normal blending keeps the purple silhouette where the outer sheets overlap.
 gl_FragColor=vec4(sampleA.rgb*heat*(.83+.17*shimmer),sampleA.a*fade*shimmer);
 #include <tonemapping_fragment>
 #include <colorspace_fragment>
}`;
export const radialVertex = /* glsl */`
varying vec2 st;
void main(){st=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}
`;
export const radialFragment = /* glsl */`
uniform float fade,time,width,mode;
varying vec2 st;
void main(){
 vec2 p=2.*(st-.5);
 float r=length(p),a=atan(p.y,p.x);
 float wav=sin(a*13.+time*3.)*.012+sin(a*27.-time*5.)*.012;
 float edge=abs(r-.78+wav);
 float rim=exp(-edge/max(width,.002));
 float hot=exp(-pow(r/(.43-.14*mode),1.5));
 float wisps=pow(.5+.5*sin(a*17.+time*2.+r*14.),7.)*exp(-23.*edge);
 float alpha=(rim*.95+hot*(.26+.45*mode)+wisps*.34)*fade;
 gl_FragColor=vec4(mix(vec3(1.13,.10,.003),vec3(2.65,.85,.055),rim*.68+hot*.25),alpha);
 #include <tonemapping_fragment>
 #include <colorspace_fragment>
}`;
