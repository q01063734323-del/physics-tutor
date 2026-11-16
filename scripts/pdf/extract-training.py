"""Extract source table rows and their rotated labels into private review files."""
import argparse
import json
import re
from pathlib import Path

import numpy as np
from PIL import Image,ImageFilter


def lines(data):
    return [line for block in data.get('blocks') or [] for p in block.get('paragraphs',[]) for line in p.get('lines',[])]


def source_events(data):
    events=[]
    for line in lines(data):
        text=re.sub(r'\s+',' ',line['text']).strip(); y=line['bbox']['y0']; height=line['bbox']['y1']-y
        if y<120 or height<22:continue
        if re.search(r'ТРЕНИРОВОЧНЫЕ\s+ЗАДАНИЯ',text,re.I):events.append((y,'training'))
        elif re.search(r'Перед выполнением заданий',text,re.I):events.append((y,'training'))
        elif re.search(r'ТИПОВЫЕ\s+ЭКЗАМЕНАЦИОННЫЕ',text,re.I):events.append((y,'typical'))
        elif re.search(r'ТЕМАТИЧЕСКИЙ\s+КОНТРОЛЬ',text,re.I):events.append((y,'control'))
    return sorted(events)


def horizontal_rules(gray, y0, y1):
    ink=gray<185
    # A vertical dilation accommodates the slight rotation of scanned table rules.
    dilated=np.maximum.reduce([np.roll(ink,shift,axis=0) for shift in range(-4,5)])
    coverage=dilated[:,70:1210].mean(axis=1)
    active=(coverage>.78) & (dilated[:,85:130].mean(axis=1)>.8)
    for y in np.flatnonzero(active):
        gaps=np.r_[-1,np.flatnonzero(~dilated[y,70:1210]),1140]
        if np.diff(gaps).max()-1<900:active[y]=False
    runs=[];start=None
    for y in range(max(110,int(y0)),min(1725,int(y1))):
        if active[y] and start is None:start=y
        elif not active[y] and start is not None:
            if y-start<=35:runs.append((start+y)//2)
            start=None
    return runs


def main():
    parser=argparse.ArgumentParser();parser.add_argument('directory',type=Path);parser.add_argument('ocr',type=Path);parser.add_argument('profile',type=Path);args=parser.parse_args()
    profile=json.loads(args.profile.read_text());chapter_starts={item['start']:item['id'] for item in profile['chapters']}
    directory=args.directory;rows=[];mode='theory';group=None;chapter=None;all_windows=[]
    crops=directory/'training-label-crops';crops.mkdir(exist_ok=True)
    for n in range(4,425):
        data=json.loads((args.ocr/f'page-{n:03}.json').read_text())
        if n in chapter_starts:chapter=chapter_starts[n];mode='theory';group=None
        if n in [4,419]:mode='test';group=None
        events=source_events(data)
        windows=[];start=115
        for y,event in events:
            if event=='training' and mode=='training':continue
            if mode=='training':windows.append((start,y-7,group))
            mode=event;start=y+40
            if event=='training':group=f'training-p{n:03}-y{y}'
        if mode=='training':windows.append((start,1720,group))
        if not windows:continue
        image=Image.open(directory/'source-pages'/f'page-{n:03}.png');gray=np.asarray(image.convert('L'))
        for y0,y1,group_id in windows:
            all_windows.append({'pdfPage':n,'range':[y0,y1],'group':group_id,'chapter':chapter})
            rules=horizontal_rules(gray,y0,y1)
            # Include open rows continuing at either end of a page.
            bounds=sorted(set([int(y0)]+rules+[int(y1)]))
            ink=gray[int(y0):int(y1),:]<190
            dilated=np.maximum.reduce([np.roll(ink,shift,axis=1) for shift in range(-3,4)])
            vertical=dilated.mean(axis=0)
            separator=int(np.argmax(vertical[115:180]))+115
            left=int(np.argmax(vertical[55:100]))+55
            if vertical[separator]<.25:continue
            for lo,hi in zip(bounds,bounds[1:]):
                if hi-lo<65:continue
                label=image.crop((left+5,lo+5,separator-5,hi-5)).transpose(Image.Transpose.ROTATE_270).convert('L')
                label=label.resize((label.width*2,label.height*2),Image.Resampling.LANCZOS)
                name=f'page-{n:03}-row-{lo:04}.png';label.save(crops/name)
                text='\n'.join(line['text'].strip() for line in lines(data) if lo<=line['bbox']['y0']<hi and line['bbox']['x1']>separator+20)
                rows.append({'id':f'p{n:03}-y{lo:04}','pdfPage':n,'bbox':[left,lo,1232,hi],'labelCrop':name,'group':group_id,'chapter':chapter,'ocrText':text})
    (directory/'training-rows.json').write_text(json.dumps({'windows':all_windows,'rows':rows},ensure_ascii=False,indent=2))
    print(json.dumps({'trainingWindows':len(all_windows),'rows':len(rows),'groups':len({w['group'] for w in all_windows})}))

if __name__=='__main__':main()
