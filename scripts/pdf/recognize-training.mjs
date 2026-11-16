import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {createWorker}=require(process.env.TESSERACT_MODULE || 'tesseract.js');
const directory=path.resolve(process.argv[2] || '.local/pdf-imports/full');
const {rows}=JSON.parse(await fs.readFile(path.join(directory,'training-rows.json'),'utf8'));
const modelDirectory=path.resolve('.local/pdf-imports/analysis/ocr');
const destination=path.join(directory,'training-labels');await fs.mkdir(destination,{recursive:true});
let next=0,done=0;
await Promise.all(Array.from({length:3},async()=>{
 const worker=await createWorker(['rus','eng'],1,{cachePath:modelDirectory,langPath:modelDirectory,gzip:false});
 await worker.setParameters({tessedit_pageseg_mode:'6',user_defined_dpi:'300'});
 try{while(next<rows.length){
  const row=rows[next++];const file=path.join(destination,row.labelCrop.replace('.png','.json'));
  const bytes=await fs.readFile(path.join(directory,'training-label-crops',row.labelCrop));
  const sha256=crypto.createHash('sha256').update(bytes).digest('hex');
  try{const previous=JSON.parse(await fs.readFile(file,'utf8'));if(previous.sha256===sha256)continue;}catch{}
  const {data}=await worker.recognize(bytes);
  await fs.writeFile(file,JSON.stringify({sha256,text:data.text,confidence:data.confidence}));
  if(++done%50===0)console.log(`${done}/${rows.length} training labels`);
 }}finally{await worker.terminate();}
}));
console.log('Training label OCR complete');
