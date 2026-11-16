"""Create private, resumable page inventory and conservative exercise boundaries.

This is extraction, not publication. Source crops remain authoritative when OCR
is uncertain; no answer or mathematical formula is inferred from broken OCR.
"""
import argparse
import hashlib
import json
import subprocess
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

import numpy as np
from PIL import Image
from pypdf import PdfReader


def atomic_json(path, value):
    temp = path.with_suffix(path.suffix + '.tmp')
    temp.write_text(json.dumps(value, ensure_ascii=False, indent=2), encoding='utf-8')
    temp.replace(path)


def find_badges(image, wide=False):
    """Connected rectangular two-cell labels in the left exercise margin."""
    gray = np.asarray(image.convert('L'))
    h, w = gray.shape
    left, right = int(w * .034), int(w * (.147 if wide else .13))
    mask = (gray[:, left:right] < 145).astype(np.uint8)
    mask[:110] = 0
    mask[int(h * .955):] = 0
    mh, mw = mask.shape
    found = []
    for y, x in zip(*np.nonzero(mask)):
        if not mask[y, x]:
            continue
        stack = [(int(x), int(y))]
        mask[y, x] = 0
        minx = maxx = int(x)
        miny = maxy = int(y)
        count = 0
        while stack:
            a, b = stack.pop()
            count += 1
            minx, maxx = min(minx, a), max(maxx, a)
            miny, maxy = min(miny, b), max(maxy, b)
            for c, d in ((a-1,b),(a+1,b),(a,b-1),(a,b+1)):
                if 0 <= c < mw and 0 <= d < mh and mask[d,c]:
                    mask[d,c] = 0
                    stack.append((c,d))
        bw, bh = maxx-minx+1, maxy-miny+1
        if not (28 <= bw <= (95 if wide else 70) and 27 <= bh <= 100 and maxx < mw-1 and minx > 0):
            continue
        region = gray[miny:maxy+1, left+minx:left+maxx+1] < 145
        horizontal = (region.sum(axis=1) / bw)
        # Outer borders and middle separator distinguish exercise badges from text.
        if region[:8].any(axis=0).mean() < .85 or region[-8:].any(axis=0).mean() < .85:
            continue
        if (region[:,:5].sum(axis=1)>0).mean() < .8 or (region[:,-5:].sum(axis=1)>0).mean() < .8:
            continue
        kind = 'double' if bh >= 55 else 'single'
        middle = int(np.argmin(gray[miny:maxy+1,left+minx+5:left+maxx-4].mean(axis=1)[int(bh*.35):int(bh*.65)]) + int(bh*.35)) if kind == 'double' else None
        found.append({'bbox':[left+minx,miny,left+maxx+1,maxy+1], 'divider':miny+middle if middle is not None else None, 'kind':kind})
    return sorted(found, key=lambda item:item['bbox'][1])


def page_lines(data):
    return [line for block in data.get('blocks') or [] for paragraph in block.get('paragraphs',[]) for line in paragraph.get('lines',[])]


def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('source',type=Path)
    parser.add_argument('--output',type=Path,default=Path('.local/pdf-imports/full'))
    parser.add_argument('--start',type=int,default=1)
    parser.add_argument('--end',type=int,default=488)
    parser.add_argument('--workers',type=int,default=3)
    args=parser.parse_args()
    root=Path.cwd().resolve()/'.local/pdf-imports'
    output=args.output.resolve()
    if not output.is_relative_to(root):raise SystemExit('Output must remain under .local/pdf-imports')
    source_hash=hashlib.sha256(args.source.read_bytes()).hexdigest()
    page_count=len(PdfReader(args.source).pages)
    pages=output/'source-pages'; boundaries=output/'boundaries'; crops=output/'badge-crops'
    for directory in (pages,boundaries,crops):directory.mkdir(parents=True,exist_ok=True)
    identity=output/'source.json'
    if identity.exists() and json.loads(identity.read_text())['sha256']!=source_hash:raise SystemExit('Different source PDF')
    atomic_json(identity,{'sha256':source_hash,'pages':page_count,'renderHeight':1800,'publication':'disabled'})
    def process(n):
        destination=boundaries/f'page-{n:03}.json'
        if destination.exists() and json.loads(destination.read_text()).get('version') == 5:return n, len(json.loads(destination.read_text())['badges']), 'resumed'
        rendered=pages/f'page-{n:03}.png'
        if not rendered.exists():
            subprocess.run(['pdftoppm','-f',str(n),'-l',str(n),'-singlefile','-scale-to','1800','-png',str(args.source),str(rendered.with_suffix(''))],check=True,capture_output=True)
        with Image.open(rendered) as image:
            badges=find_badges(image, wide=(4 <= n <= 9 or 419 <= n <= 424)) if n<425 else []
            for index,badge in enumerate(badges):
                x0,y0,x1,y1=badge['bbox']; divider=badge['divider']
                halves = [('exam',[x0+6,y0+6,x1-6,divider-5]),('number',[x0+6,divider+6,x1-6,y1-6])] if divider else [('number',[x0+6,y0+6,x1-6,y1-6])]
                for half,box in halves:
                    selected=image.crop(box).convert('L').point(lambda value:255 if value>(90 if half=='exam' else 125) else 0)
                    selected=selected.resize((selected.width*5,selected.height*5))
                    padded=Image.new('L',(selected.width+40,selected.height+40),255)
                    padded.paste(selected,(20,20))
                    name=f'page-{n:03}-badge-{index:02}-{half}.png'
                    padded.save(crops/name)
                    badge[half+'Crop']=name
            atomic_json(destination,{'version':5,'sourceHash':source_hash,'pdfPage':n,'width':image.width,'height':image.height,'badges':badges})
        return n,len(badges),'saved'
    with ThreadPoolExecutor(max_workers=max(1,min(4,args.workers))) as pool:
        futures=[pool.submit(process,n) for n in range(args.start,min(args.end,page_count)+1)]
        for future in as_completed(futures):
            n,count,state=future.result()
            if n%10==0 or count:print(f'PAGE {n}/{page_count}: {count} labels; {state}',flush=True)
    print('Page extraction complete',flush=True)

if __name__=='__main__':main()
