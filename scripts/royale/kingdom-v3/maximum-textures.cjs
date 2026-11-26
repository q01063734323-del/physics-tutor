// Builds original foliage sprays and adds a painted microdetail layer to the existing PBR maps.
const sharp = require(process.env.KINGDOM_SHARP || 'sharp');
const fs = require('node:fs/promises');
const path = require('node:path');
const [source, target] = process.argv.slice(2);
let seed = 198733;
function random() {
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  return seed / 4294967296;
}
const between = (a,b) => a + (b-a)*random();
const palettes = [
  ['#25482c','#6d842b','#b1ae4c'], ['#153c3b','#467448','#91a04f'],
  ['#56331d','#a96523','#dba849'], ['#29494b','#708c57','#b9ba63'],
];
const document = (w,h,body) => Buffer.from(`<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">${body}</svg>`);
const leaf = 'M-28 0Q-19-8-14-9L-16-12-8-12-8-15 1-13 5-16 13-11 16-12 21-7 30 0 21 7 16 12 13 11 5 16 1 13-8 15-8 12-16 12-14 9Q-19 8-28 0Z';
async function foliage() {
  const definitions = palettes.map(([dark,mid,light],i) => `<linearGradient id="t${i}" x1="0" y1=".9" x2=".8" y2="0">
    <stop stop-color="${dark}"/><stop offset=".47" stop-color="${mid}"/><stop offset="1" stop-color="${light}"/></linearGradient>`).join('');
  const sprays = palettes.map(([dark,,light],palette) => {
    const painted = ['<path d="M63 440Q189 261 437 73M131 351Q125 231 170 151M206 270Q272 270 386 225M273 208Q259 129 284 88" fill="none" stroke="#68523a" stroke-width="7" stroke-linecap="round"/>'];
    for (let j=0;j<40;j++) {
      const depth = j/40;
      const x = (92 + depth * 334) + between(-70,62);
      const y = (403 - depth * 310) + between(-70,78);
      const angle=between(-80,25) + (j%2===0 ? -45:55);
      const scale=between(.66,1.75)*(1-depth*.26);
      painted.push(`<g transform="translate(${x} ${y}) rotate(${angle}) scale(${scale})" opacity="${between(.92,1)}">
        <path d="${leaf}" fill="url(#t${palette})" stroke="${dark}" stroke-width="1.4"/>
        <path d="M-25 0Q3 2 25 0M-13 1l11-9m-5 9L4 10m3-9 9-7" fill="none" stroke="${light}" stroke-width="1.1" opacity=".44"/>
        <path d="M-19-5Q-1-17 14-9" fill="none" stroke="${light}" stroke-width="1.4" opacity=".36"/>
      </g>`);
    }
    return `<g transform="translate(${512*(palette%2)} ${512*Math.floor(palette/2)})">${painted.join('')}</g>`;
  });
  await sharp(document(1024,1024,`<defs>${definitions}</defs>${sprays.join('')}`)).png().toFile(path.join(target,'sprays-color.png'));
}

async function weather(family, lineCount, scale) {
  const side=768;
  const height=new Float32Array(side*side);
  const fissures=[];
  for(let i=0;i<lineCount;i++) {
    const x=between(-35,768),y=between(0,768);
    let endX=x,endY=y;
    const points=[`M${x} ${y}`];
    for(let k=0;k<5;k++) {
      endX+=between(-5,9)*scale;
      endY+=between(.2,4.7)*scale;
      points.push(`L${endX} ${endY}`);
    }
    const d=points.join('');
    const width=between(.7,2.5);
    fissures.push(`<path d="${d}" stroke="#ffd6a5" opacity=".26" transform="translate(1.8 -1.1)" stroke-width="${width}"/><path d="${d}" stroke="#281b29" opacity="${between(.24,.55)}" stroke-width="${width}"/>`);
  }
  const pits=Array.from({length:1450},()=>{
    const r=between(.35,2.4);
    return `<circle cx="${between(0,side)}" cy="${between(0,side)}" r="${r}" fill="${random()>.63?'#ffefd2':'#312a39'}" opacity="${between(.06,.22)}"/>`;
  });
  const cracks=document(side,side,`<g fill="none" stroke-linecap="round">${fissures.join('')}</g>${pits.join('')}`);
  const input = suffix => path.join(source,`${family}-${suffix}`);
  await sharp(input('color.jpg')).resize(side,side).composite([{input:cracks}]).jpeg({quality:90}).toFile(path.join(target,`${family}-color.jpg`));
  const [original,detail] = await Promise.all([
    sharp(input('normal.jpg')).resize(side,side).removeAlpha().raw().toBuffer(),
    sharp(cracks).flatten({background:'#9a9a9a'}).greyscale().raw().toBuffer(),
  ]);
  for(let i=0;i<height.length;i++)height[i]=(detail[i]-154)/255;
  const enhanced = Buffer.alloc(original.length);
  const limit=x=>Math.round(Math.max(0,Math.min(255,x)));
  for(let y=0;y<side;y++)for(let x=0;x<side;x++) {
    const i=y*side+x,j=i*3;
    const dx=height[y*side+(x+1)%side]-height[y*side+(x+side-1)%side];
    const dy=height[((y+1)%side)*side+x]-height[((y+side-1)%side)*side+x];
    enhanced[j]=limit(original[j]-91*dx);
    enhanced[j+1]=limit(original[j+1]+91*dy);
    enhanced[j+2]=original[j+2];
  }
  await sharp(enhanced,{raw:{width:side,height:side,channels:3}}).jpeg({quality:94}).toFile(path.join(target,`${family}-normal.jpg`));
}

async function build() {
  await fs.mkdir(target,{recursive:true});
  for(const entry of await fs.readdir(source))await fs.copyFile(path.join(source,entry),path.join(target,entry));
  await foliage();
  for(const [family,count,scale] of [['stone',105,1.2],['trim',72,.73],['cliff',168,1.6],['wood',82,2.15],['roof',58,.84],['gold',55,.55]]) {
    await weather(family,count,scale);
  }
}
build().catch(error=>{console.error(error);process.exitCode=1;});
