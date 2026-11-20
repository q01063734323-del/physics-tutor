import {cp,mkdir,readFile} from 'node:fs/promises';
const manifest=JSON.parse(await readFile(new URL('../node_modules/pdfjs-dist/package.json',import.meta.url),'utf8'));
const output=new URL('../public/pdf-assets/',import.meta.url);await mkdir(output,{recursive:true});
await cp(new URL('../node_modules/pdfjs-dist/build/pdf.worker.min.mjs',import.meta.url),new URL(`pdf.worker-${manifest.version}.mjs`,output));
for(const folder of ['cmaps','standard_fonts','wasm'])await cp(new URL(`../node_modules/pdfjs-dist/${folder}/`,import.meta.url),new URL(folder+'/',output),{recursive:true});
console.log('PDF worker and font resources prepared locally:',manifest.version);
