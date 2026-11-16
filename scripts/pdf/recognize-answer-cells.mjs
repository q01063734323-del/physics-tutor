// OCR stays on this machine; all results remain unverified source candidates.
import fs from 'node:fs/promises';import path from 'node:path';import crypto from 'node:crypto';import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);const {createWorker}=require(process.env.TESSERACT_MODULE || 'tesseract.js');
const directory=path.resolve(process.argv[2] || '.local/pdf-imports/full');
const mode=process.argv[3] || 'answers';
const data=JSON.parse(await fs.readFile(path.join(directory,mode==='solutions'?'solution-candidates.json':'answer-cells.json'),'utf8'));
const cells=mode==='solutions'?data.solutions:data.cells;
const files=mode==='solutions'?cells.map(cell=>cell.labelCrop):cells.flatMap(cell=>[cell.numberCrop,cell.answerCrop]);
const cropDirectory=mode==='solutions'?'solution-label-crops':'answer-ocr-crops';
const destination=path.join(directory,mode==='solutions'?'solution-labels':'answer-ocr');await fs.mkdir(destination,{recursive:true});
const models=path.resolve('.local/pdf-imports/analysis/ocr');let next=0,done=0;
await Promise.all(Array.from({length:3},async()=>{
 const worker=await createWorker('eng',1,{cachePath:models,langPath:models,gzip:false});
 await worker.setParameters({tessedit_pageseg_mode:'6',tessedit_char_whitelist:'0123456789.,-−+()/;eE±·^',user_defined_dpi:'300'});
 try{while(next<files.length){
  const name=files[next++],file=path.join(destination,name.replace('.png','.json'));
  const bytes=await fs.readFile(path.join(directory,cropDirectory,name));const sha256=crypto.createHash('sha256').update(bytes).digest('hex');
  try{const previous=JSON.parse(await fs.readFile(file,'utf8'));if(previous.sha256===sha256)continue;}catch{}
  const {data}=await worker.recognize(bytes);
  await fs.writeFile(file,JSON.stringify({sha256,text:data.text.trim(),confidence:data.confidence,status:'needs_review'}));
  if(++done%250===0)console.log(`${done}/${files.length} answer cells recognized`);
 }}finally{await worker.terminate();}
}));console.log(JSON.stringify({cells:cells.length,crops:files.length,recognized:done}));
