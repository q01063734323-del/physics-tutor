import sharp from 'sharp';
import fs from 'node:fs/promises';
import path from 'node:path';

const [source, target, sky] = process.argv.slice(2);
await fs.mkdir(target, { recursive:true });
const size=384;
const sources={stone:'stone',trim:'stone',joint:'stone',cliff:'cliff',floor:'floor',wood:'wood',ground:'cliff',roof:'stone',gold:'stone',cloth:'stone',leaf:'stone'};
const palette={
 stone:[220,184,143],trim:[239,205,170],joint:[104,98,103],cliff:[100,95,114],
 floor:[176,150,125],wood:[115,73,45],ground:[113,141,66],
 roof:[36,87,160],gold:[191,134,63],cloth:[34,67,120],leaf:[127,156,76],
};
const clamp=(v,lo=0,hi=255)=>Math.min(hi,Math.max(lo,v));
const read=async(f,c)=>sharp(path.join(source,f)).resize(size,size,{fit:'fill'})[c===1?'greyscale':'removeAlpha']().raw().toBuffer();
function save(buffer,channels,format,file) {
 return sharp(buffer,{raw:{width:size,height:size,channels}})[format](format==='jpeg'?{quality:86,mozjpeg:true}:{compressionLevel:8}).toFile(path.join(target,file));
}
for(const [family,original] of Object.entries(sources)){
 const [diff,nor,rough,ao]=await Promise.all([
  read(original+'-diff.jpg',1),read(original+'-nor_gl.jpg',3),read(original+'-rough.jpg',1),read(original+'-ao.jpg',1),
 ]);
 const color=Buffer.alloc(size*size*3),normal=Buffer.alloc(size*size*3),orm=Buffer.alloc(size*size*3);
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  const j=y*size+x;
  const u=x/size,v=y/size;
  let paint=palette[family];
  let luma=diff[j]/255-.49;
  let broad=Math.sin(u*12.57+2.4*Math.sin(v*6.28))*.028+Math.cos(v*18.85+u*6.28)*.026;
  let micro=0;
  if(family==='leaf'){
   const cell=Math.floor(u*2)+2*(1-Math.floor(v*2));
   paint=[[134,169,69],[64,121,81],[185,139,65],[103,145,94]][cell];
   const a=(u*2%1)-.5, b=v*2%1;
   const ribs=Math.cos(b*91+Math.abs(a)*24)*.025;
   micro=.09*(1-Math.abs(a)*2)+ribs+.08*Math.exp(-Math.abs(a)*79)-.13*b;
   luma*=.27;
  } else if(family==='roof'){
   const yy=v*13;
   const seam=1-(yy%1);
   const xx=u*9+.5*Math.floor(yy);
   micro=(seam<.10?-.22:seam<.21?.13:0)+(.5-Math.abs(xx%1-.5))*.075;
   luma*=.30;
  } else if(family==='cliff'){
   micro=.071*Math.sin(v*35+u*8+Math.sin(u*17)*1.38)+.042*Math.cos(v*71+Math.sin(u*15));
   luma*=.81;
  } else if(family==='ground'){
   micro=.10*Math.sin(v*19+Math.sin(u*15)*2.1)+.11*Math.cos(u*11+v*15);
   luma*=.65;
  } else if(family==='gold'){
   luma*=.24;
   micro=.032*Math.sin((u*19+v*29)*Math.PI)+.036*Math.cos(18*u);
  } else if(family==='cloth'){
   luma*=.31;
   micro=.042*Math.cos(u*179)*Math.cos(v*181);
  } else luma*=family==='trim'?.38:.65;
  const factor=1+luma+broad+micro;
  const aoWeight=['roof','gold','cloth','leaf'].includes(family)?.18:.50;
  for(let c=0;c<3;c++){
   color[3*j+c]=clamp(paint[c]*factor*(1-aoWeight*.34*(1-ao[j]/255)));
   normal[3*j+c]=c===2?clamp(225+nor[3*j+c]*.115):clamp(128+(nor[3*j+c]-128)*(['cliff','stone','wood','floor'].includes(family)?.76:.28));
  }
  orm[3*j]=clamp(255-(255-ao[j])*aoWeight,.0);
  orm[3*j+1]=family==='gold'?clamp(78+(rough[j]-128)*.30):family==='roof'?clamp(145+(rough[j]-128)*.20):clamp(222+(rough[j]-128)*.30);
  orm[3*j+2]=family==='gold'?194:family==='roof'?12:0;
 }
 await Promise.all([
  save(color,3,'jpeg',family+'-color.jpg'),
  save(normal,3,'jpeg',family+'-normal.jpg'),
  save(orm,3,'png',family+'-orm.png'),
 ]);
}
await sharp(sky).resize(1600).webp({quality:87}).toFile(path.join(target,'sky.webp'));
await sharp(sky).extract({left:450,top:0,width:760,height:941}).resize(650).webp({quality:84}).toFile(path.join(target,'sky-portrait.webp'));
