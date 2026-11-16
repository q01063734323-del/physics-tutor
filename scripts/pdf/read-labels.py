"""Read small printed exercise labels using visually verified digit exemplars.

OCR alternatives and template distances are recorded; ambiguous labels never
become teacher-verified answers or publication approval.
"""
import argparse
import json
from pathlib import Path

import numpy as np
from PIL import Image


def components(image):
    mask=(np.asarray(image.convert('L'))<128).astype(np.uint8)
    h,w=mask.shape; result=[]
    for y,x in zip(*np.nonzero(mask)):
        if not mask[y,x]:continue
        stack=[(int(x),int(y))];mask[y,x]=0;xs=[];ys=[]
        while stack:
            a,b=stack.pop();xs.append(a);ys.append(b)
            for c,d in ((a-1,b),(a+1,b),(a,b-1),(a,b+1)):
                if 0<=c<w and 0<=d<h and mask[d,c]:mask[d,c]=0;stack.append((c,d))
        x0,x1,y0,y1=min(xs),max(xs)+1,min(ys),max(ys)+1
        if y1-y0<max(15,h*.23) or x1-x0>(y1-y0)*2.3 or len(xs)<60:continue
        result.append((x0,y0,x1,y1,len(xs)))
    if not result:return []
    maximum=max(b[3]-b[1] for b in result)
    return sorted([b for b in result if b[3]-b[1]>=maximum*.58],key=lambda b:b[0])


def signature(image,box):
    x0,y0,x1,y1,*_=box
    selected=image.crop((x0,y0,x1,y1)).convert('L')
    width=max(1,min(28,round(selected.width*32/selected.height)))
    selected=selected.resize((width,32),Image.Resampling.LANCZOS)
    canvas=Image.new('L',(36,40),255);canvas.paste(selected,((36-width)//2,4))
    return 1-np.asarray(canvas,dtype=float)/255


def distance(first,second):
    return min(float(np.mean((first-np.roll(np.roll(second,y,axis=0),x,axis=1))**2)) for y in [-1,0,1] for x in [-1,0,1])


def main():
    parser=argparse.ArgumentParser();parser.add_argument('directory',type=Path);parser.add_argument('profile',type=Path);args=parser.parse_args()
    profile=json.loads(args.profile.read_text()); templates=[]
    crops=args.directory/'badge-crops'
    for item in profile['digitExemplars']:
        image=Image.open(crops/item['crop']);boxes=components(image)
        if len(boxes)!=len(item['text']):raise ValueError(f"Exemplar {item} has {len(boxes)} components")
        templates.extend((int(digit),signature(image,box)) for digit,box in zip(item['text'],boxes))
    destination=args.directory/'labels';destination.mkdir(exist_ok=True)
    count=0
    for pagefile in sorted((args.directory/'boundaries').glob('*.json')):
        page=json.loads(pagefile.read_text()); labels=[]
        for badge in page['badges']:
            label={'bbox':badge['bbox'],'kind':badge['kind']}
            for kind in ['exam','number']:
                crop=badge.get(kind+'Crop')
                if not crop:continue
                image=Image.open(crops/crop);boxes=components(image);digits=[];scores=[];margins=[]
                def match(box):
                    glyph=signature(image,box)
                    distances={digit:min(distance(glyph,t) for n,t in templates if n==digit) for digit in range(10)}
                    ranked=sorted(distances.items(),key=lambda pair:pair[1])
                    return str(ranked[0][0]),ranked[0][1],ranked[1][1]-ranked[0][1]
                for box in boxes:
                    matches=[match(box)]
                    x0,y0,x1,y1,_=box
                    if x1-x0 > (y1-y0)*.95:
                        pixels=(np.asarray(image.convert('L'))[y0:y1,x0:x1]<128).sum(axis=0)
                        start,end=int((x1-x0)*.32),int((x1-x0)*.68)
                        cut=x0+start+int(np.argmin(pixels[start:end]))
                        halves=[]
                        for lo,hi in [(x0,cut),(cut,x1)]:
                            part=(np.asarray(image.convert('L'))[y0:y1,lo:hi]<128)
                            ys,xs=np.nonzero(part)
                            if len(xs):halves.append((lo+int(xs.min()),y0+int(ys.min()),lo+int(xs.max())+1,y0+int(ys.max())+1,len(xs)))
                        if len(halves)==2:
                            split=[match(part) for part in halves]
                            if max(item[1] for item in split)+.015 < matches[0][1]:matches=split
                    for digit,score,margin in matches:
                        digits.append(digit);scores.append(score);margins.append(margin)
                value=int(''.join(digits)) if 1<=len(digits)<=3 else None
                label[kind]={'value':value,'distance':max(scores,default=1),'margin':min(margins,default=0),'method':'source-digit-exemplars','crop':crop,'needsReview':True}
                ocr=args.directory/'badge-ocr'/crop.replace('.png','.json')
                if ocr.exists():label[kind]['ocr']=json.loads(ocr.read_text())
            labels.append(label)
        (destination/pagefile.name).write_text(json.dumps({'pdfPage':page['pdfPage'],'labels':labels},ensure_ascii=False,indent=2))
        count+=len(labels)
    print(json.dumps({'labels':count,'templates':len(templates)}))

if __name__=='__main__':main()
