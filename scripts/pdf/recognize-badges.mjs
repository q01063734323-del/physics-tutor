// Local OCR of the two printed numbers in an exercise badge. No page upload.
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
const require=createRequire(import.meta.url);
const {createWorker}=require(process.env.TESSERACT_MODULE || 'tesseract.js');
const directory=path.resolve(process.argv[2] || '.local/pdf-imports/full');
const modelDirectory=path.resolve('.local/pdf-imports/analysis/ocr');
await fs.mkdir(path.join(directory,'badge-ocr'),{recursive:true});
const pages=(await fs.readdir(path.join(directory,'boundaries'))).filter(file=>file.endsWith('.json')).sort();
const files=[];
for(const file of pages){const page=JSON.parse(await fs.readFile(path.join(directory,'boundaries',file),'utf8'));for(const badge of page.badges){if(badge.examCrop)files.push(badge.examCrop);files.push(badge.numberCrop);}}
let next=0,completed=0;
await Promise.all(Array.from({length:3},async()=>{
 const worker=await createWorker('eng',1,{cachePath:modelDirectory,langPath:modelDirectory,gzip:false});
 await worker.setParameters({tessedit_char_whitelist:'0123456789',tessedit_pageseg_mode:'7',user_defined_dpi:'300'});
 try{
  while(next<files.length){
   const file=files[next++]; const destination=path.join(directory,'badge-ocr',file.replace('.png','.json'));
   const bytes=await fs.readFile(path.join(directory,'badge-crops',file));
   const sha256=crypto.createHash('sha256').update(bytes).digest('hex');
   try{const previous=JSON.parse(await fs.readFile(destination,'utf8'));if(previous.sha256===sha256)continue;}catch{}
   const {data}=await worker.recognize(bytes);
   const text=data.text.trim();
   const result={file,sha256,text,confidence:data.confidence,value:/^\d{1,3}$/.test(text)?Number(text):null};
   await fs.writeFile(destination+'.tmp',JSON.stringify(result)); await fs.rename(destination+'.tmp',destination);
   completed++; if(completed%100===0)console.log(`${completed} badges read / ${files.length} crops`);
  }
 }finally{await worker.terminate();}
}));
console.log(JSON.stringify({availableCrops:files.length,completed}));
