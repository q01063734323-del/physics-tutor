"""Extract printed answer-key cells as review candidates, never grading keys."""
import argparse
import importlib.util
import json
import re
from pathlib import Path

import numpy as np
from PIL import Image

spec=importlib.util.spec_from_file_location('training',Path(__file__).with_name('extract-training.py'))
training=importlib.util.module_from_spec(spec);spec.loader.exec_module(training)
spec=importlib.util.spec_from_file_location('segmentation',Path(__file__).with_name('segment-bank.py'))
segmentation=importlib.util.module_from_spec(spec);spec.loader.exec_module(segmentation)


def runs(values):
    starts=np.flatnonzero(np.diff(np.r_[False,values,False].astype(int))==1)
    ends=np.flatnonzero(np.diff(np.r_[False,values,False].astype(int))==-1)
    return [(int(start),int(end)) for start,end in zip(starts,ends)]


def tables(gray, caption_breaks=()):
    ink=gray<185
    dilated=np.maximum.reduce([np.roll(ink,shift,axis=0) for shift in range(-4,5)])
    active=(dilated[:,70:1215].mean(axis=1)>.5)&(dilated[:,85:130].mean(axis=1)>.8)
    for y in np.flatnonzero(active):
        gaps=np.r_[-1,np.flatnonzero(~dilated[y,70:1215]),1145]
        if np.diff(gaps).max()-1<600:active[y]=False
    horizontal=[(lo+hi)//2 for lo,hi in runs(active) if hi-lo<30 and lo>120 and hi<1720]
    groups=[];group=[]
    for y in horizontal:
        if group and (y-group[-1]>70 or any(group[-1]+4<caption<y-4 for caption in caption_breaks)):
            if len(group)>=3:groups.append(group)
            group=[]
        group.append(y)
    if len(group)>=3:groups.append(group)
    output=[]
    for ys in groups:
        y0=ys[0];y1=ys[-1]
        vertical=np.maximum.reduce([np.roll(ink[y0+5:min(y0+85,y1-3)],shift,axis=1) for shift in range(-2,3)]).mean(axis=0)>.72
        xs=[(lo+hi)//2 for lo,hi in runs(vertical) if 50<lo<1240 and hi-lo<20]
        if len(xs) not in [7,9,11]:continue
        output.append({'x':xs,'y':ys})
    return output


def main():
    p=argparse.ArgumentParser();p.add_argument('directory',type=Path);p.add_argument('ocr',type=Path);args=p.parse_args()
    destination=args.directory/'answer-ocr-crops';destination.mkdir(exist_ok=True)
    profile=json.loads((args.directory/'source-profile.json').read_text())
    solutions=[];active_solution=None
    solution_crops=args.directory/'solution-label-crops';solution_crops.mkdir(exist_ok=True)
    cells=[];inventory=[];chapter=0;section={'kind':'diagnostic','examNumbers':[],'controlNumber':None}
    for n in range(425,489):
        if n==433:chapter=1
        if n==477:chapter=16
        if n==486:chapter=0;section={'kind':'final','examNumbers':[],'controlNumber':None}
        data=json.loads((args.ocr/f'page-{n:03}.json').read_text())
        events=[]
        for line in training.lines(data):
            text=re.sub(r'\s+',' ',line['text']).strip();y=line['bbox']['y0']
            if y<105:continue
            match=re.search(r'[ТT][ЕE][МM][АA]\s+(\d{1,2})[.,]',text,re.I) if y>=125 else None
            if match:events.append((y,'chapter',int(match.group(1))))
            if re.search('ИНТЕГРИРОВАННОЕ ЗАДАНИЕ',text,re.I):events.append((y,'chapter',14))
            if re.search('МЕТОДЫ НАУЧНОГО ПОЗНАНИЯ',text,re.I):events.append((y,'chapter',15))
            match=re.search(r'ТЕМАТИЧЕСКИЙ КОНТРОЛЬ\s*([12])',text,re.I)
            if match:events.append((y,'section',{'kind':'control','examNumbers':[],'controlNumber':int(match.group(1))}))
            elif re.match(r'Задани[ея]\s+',text,re.I):
                numbers=[int(value) for value in re.findall(r'\d+',text)]
                events.append((y,'section',{'kind':'typical','examNumbers':numbers if numbers and all(1<=number<=26 for number in numbers) else [],'controlNumber':None}))
        events.sort(key=lambda event:event[0]);position=0
        start_chapter,start_section=chapter,section
        image=Image.open(args.directory/'source-pages'/f'page-{n:03}.png');gray=np.asarray(image.convert('L'))
        detected_tables=tables(gray,[event[0] for event in events])
        for table_index,table in enumerate(detected_tables):
            xs,ys=table['x'],table['y']
            while position<len(events) and events[position][0]<ys[0]:
                _,kind,value=events[position]
                if kind=='chapter':chapter=value
                else:section=value
                position+=1
            section=profile.get('answerTableOverrides',{}).get(f'{n}:{table_index}',section)
            inventory.append({'pdfPage':n,'table':table_index,'chapter':chapter,'section':section,'x':xs,'y':ys})
            for row_index in range(1,len(ys)-1):
                lo,hi=ys[row_index:row_index+2]
                for pair in range((len(xs)-1)//2):
                    x0,xmid,x1=xs[pair*2:pair*2+3]
                    # The last column may end above the remaining rows.
                    upper=(gray[max(0,lo-5):lo+6,x0+5:x1-5]<185).any(axis=0).mean()
                    lower=(gray[max(0,hi-5):hi+6,x0+5:x1-5]<185).any(axis=0).mean()
                    if min(upper,lower)<.75:continue
                    identity=f'p{n:03}-t{table_index:02}-r{row_index:02}-c{pair:02}'
                    for kind,box in [('number',[x0+7,lo+6,xmid-7,hi-6]),('answer',[xmid+7,lo+6,x1-7,hi-6])]:
                        if box[2]<=box[0] or box[3]<=box[1]:continue
                        crop=image.crop(box).convert('L');crop=crop.resize((crop.width*4,crop.height*4),Image.Resampling.LANCZOS)
                        crop.save(destination/f'{identity}-{kind}.png')
                    cells.append({'id':identity,'pdfPage':n,'chapterId':chapter,'section':section,'bbox':[x0,lo,x1,hi],'numberCrop':f'{identity}-number.png','answerCrop':f'{identity}-answer.png','status':'needs_review'})
        source_labels=segmentation.find_badges(image,wide=True)
        solution_headers=[]
        for line in training.lines(data):
            if not re.search(r'Возможное решение',line['text'],re.I):continue
            y=line['bbox']['y0']
            nearby=[badge for badge in source_labels if badge['kind']=='single' and abs(badge['bbox'][1]-y)<35]
            if len(nearby)!=1:continue
            badge=nearby[0];x0,y0,x1,y1=badge['bbox']
            label=image.crop((x0+5,y0+5,x1-5,y1-5)).convert('L')
            label=label.resize((label.width*4,label.height*4),Image.Resampling.LANCZOS)
            identity=f'solution-p{n:03}-y{y0:04}';filename=identity+'.png';label.save(solution_crops/filename)
            local_chapter,local_section=start_chapter,start_section
            for ey,event,value in events:
                if ey>=y:break
                if event=='chapter':local_chapter=value
                else:local_section=value
            solution_headers.append({'id':identity,'pdfPage':n,'start':max(110,y0-8),'labelCrop':filename,'chapterId':local_chapter,'section':local_section})
        solution_headers.sort(key=lambda item:item['start'])
        breaks=sorted(set([event[0] for event in events]+[table['y'][0] for table in detected_tables]+[item['start'] for item in solution_headers]))
        first_break=min(breaks,default=1720)
        if active_solution is not None and first_break>190:
            solutions[active_solution]['fragments'].append({'pdfPage':n,'bbox':[45,115,1235,first_break-8]})
            if first_break<1720:active_solution=None
        elif breaks:active_solution=None
        for header in solution_headers:
            end=min((value-8 for value in breaks if value>header['start']+40),default=1720)
            if end-header['start']<50:continue
            solutions.append({**header,'fragments':[{'pdfPage':n,'bbox':[45,header['start'],1235,end]}],'status':'needs_review'})
            active_solution=len(solutions)-1 if end==1720 else None
        while position<len(events):
            _,kind,value=events[position]
            if kind=='chapter':chapter=value
            else:section=value
            position+=1
    (args.directory/'solution-candidates.json').write_text(json.dumps({'solutions':solutions},ensure_ascii=False,indent=2))
    (args.directory/'answer-cells.json').write_text(json.dumps({'tables':inventory,'cells':cells},ensure_ascii=False,indent=2))
    print(json.dumps({'tables':len(inventory),'cells':len(cells),'solutionCandidates':len(solutions)}))

if __name__=='__main__':main()
