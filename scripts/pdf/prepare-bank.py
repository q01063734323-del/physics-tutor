"""Prepare a complete *private candidate bank*, without publishing or Firebase.

Conditions and figures are preserved together as source crops. OCR text and
printed number recognition remain candidates until a human checks them. Missing
answers are never inferred. Every PDF page is retained for checking boundaries.
"""
import argparse
import hashlib
import io
import importlib.util
import json
import re
from collections import Counter,defaultdict
from pathlib import Path

from PIL import Image
from pypdf import PdfReader
from review_contract import apply_review
spec = importlib.util.spec_from_file_location('training', Path(__file__).with_name('extract-training.py'))
training = importlib.util.module_from_spec(spec)
spec.loader.exec_module(training)


def digest(value):
    return hashlib.sha256(value).hexdigest()


def save_json(path, value):
    temp = path.with_suffix('.json.tmp')
    temp.write_text(json.dumps(value, ensure_ascii=False, indent=2), encoding='utf-8')
    temp.replace(path)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('source', type=Path)
    parser.add_argument('--directory', type=Path, default=Path('.local/pdf-imports/full'))
    args = parser.parse_args()
    directory = args.directory.resolve()
    if not directory.is_relative_to(Path.cwd().resolve() / '.local/pdf-imports'):
        raise SystemExit('Only private output under .local/pdf-imports is allowed')
    profile = json.loads((directory / 'source-profile.json').read_text())
    source_hash = digest(args.source.read_bytes())
    if source_hash != profile['sourceHash']:
        raise SystemExit('Source profile does not match this PDF')
    pages = len(PdfReader(args.source).pages)
    ocr_directory = directory.parent / 'analysis/ocr'
    chapters = profile['chapters']
    chapter_by_id = {chapter['id']: chapter for chapter in chapters}
    chapter_starts = {chapter['start'] for chapter in chapters}
    answer_ranges = {1:(433,434),2:(434,436),3:(437,439),4:(440,446),5:(447,448),6:(448,451),7:(452,457),8:(458,460),9:(461,466),10:(467,468),11:(469,472),12:(473,474),13:(475,476),14:(476,476),15:(476,476),16:(477,485)}
    assets_directory = directory / 'assets'
    assets_directory.mkdir(exist_ok=True)
    assets = {f'page-{n:03}.png' for n in range(1, pages+1)}
    old_manifest = directory / 'manifest.json'
    previous = {item['id']:item for item in json.loads(old_manifest.read_text()).get('questions', [])} if old_manifest.exists() else {}
    if old_manifest.exists() and json.loads(old_manifest.read_text())['sourceId'] != source_hash:
        raise SystemExit('Refusing to mix source documents')
    ocr = {n:json.loads((ocr_directory / f'page-{n:03}.json').read_text()) for n in range(1,pages+1)}
    candidates, excluded, unresolved = [], [], []
    used_pages = set()
    crop_index_file = directory/'crop-index.json'
    crop_index = json.loads(crop_index_file.read_text()) if crop_index_file.exists() else {}

    def chapter_for(n):
        return next((chapter for chapter in reversed(chapters) if chapter['start'] <= n), None)

    def crop(n, box, role='condition'):
        cache_key=f'{source_hash}:{n}:'+','.join(str(int(value)) for value in box)
        cached=crop_index.get(cache_key)
        if cached and (assets_directory/cached).exists():
            assets.add(cached);used_pages.add(n)
            return {'asset':cached,'pdfPage':n,'bbox':box,'role':role}
        with Image.open(directory/'source-pages'/f'page-{n:03}.png') as image:
            x0,y0,x1,y1 = [int(value) for value in box]
            if not (0 <= x0 < x1 <= image.width and 0 <= y0 < y1 <= image.height):
                raise ValueError(f'Invalid crop p{n}: {box}')
            selected = image.crop((x0,y0,x1,y1))
            encoded = io.BytesIO()
            selected.save(encoded, format='PNG', compress_level=6)
        content = encoded.getvalue()
        filename = f'crop-{digest(content)[:20]}.png'
        destination = assets_directory / filename
        if not destination.exists(): destination.write_bytes(content)
        assets.add(filename)
        crop_index[cache_key]=filename
        if len(crop_index)%20==0:save_json(crop_index_file,crop_index)
        used_pages.add(n)
        return {'asset':filename, 'pdfPage':n, 'bbox':[x0,y0,x1,y1], 'role':role}

    def make_candidate(n, key, kind, source_number, exam_number, number_clear, fragments, text, chapter=None):
        chapter = chapter or chapter_for(n)
        title = chapter['title'] if chapter else 'Входная диагностика'
        section = chapter['section'] if chapter else 'Эксперимент и анализ данных'
        if kind == 'final':title,section = 'Итоговый контроль','Эксперимент и анализ данных'
        labels = {'typical':'типовая задача','control':'тематический контроль','diagnostic':'входная диагностика','final':'итоговый контроль','training':'тренировочное задание'}
        lo,hi = (425,432) if kind=='diagnostic' else (486,488) if kind=='final' else answer_ranges[chapter['id']]
        issues = ['Требуется сверка условия, границ фрагмента и формул со сканом.', 'Ответ из таблицы ещё не перенесён в проверенный эталон. Автопроверка отключена.']
        if not number_clear:issues.append('Маленькая печатная метка распознана неоднозначно; номер не подтверждён.')
        if ocr[n]['confidence'] < 85:issues.append('Страница имеет пониженную уверенность OCR; текст нельзя считать точной транскрипцией.')
        return {'id':f'pdf-{source_hash[:12]}-{key}', 'chapterId':chapter['id'] if chapter else 0,
                'chapter':title,'section':section,'topics':[title], 'kind':kind,
                'label':f'{title} · {labels[kind]} {source_number if source_number is not None else "(номер не прочитан)"}',
                'sourceExerciseNumber':source_number,'sourceExamNumber':exam_number,
                'numberStatus':'candidate' if number_clear else 'unreadable',
                'ocrText':text.strip(), 'fragments':fragments,'answerPages':list(range(lo,hi+1)),
                'answer':None,'solution':None,'pilotQuestionId':None,
                'review':{'status':'needs_review','issues':issues},'rights':'unknown'}

    # Typical tasks have a two-cell printed badge; controls have a single cell.
    # All classifications remain draft metadata, never a publishable record.
    mode = 'theory'
    control_number = None
    current_group = 'diagnostic'
    for n in range(4,425):
        if n in chapter_starts:mode = 'theory';control_number = None;current_group=f'chapter-{chapter_for(n)["id"]}-reference'
        if n == 4:mode = 'diagnostic'
        if n == 419:mode = 'final';current_group='final'
        events = training.source_events(ocr[n])
        control_match = re.search(r'ТЕМАТИЧЕСКИЙ КОНТРОЛЬ\s*([12])', ocr[n]['text'], re.I)
        if control_match:control_number=int(control_match.group(1))
        labels = json.loads((directory/'labels'/f'page-{n:03}.json').read_text())['labels']
        labels.extend(profile.get('extraLabels',{}).get(str(n),[]))
        labels.sort(key=lambda label:label['bbox'][1])
        manual_numbers=profile.get('manualNumberSequences',{}).get(str(n))
        if manual_numbers:
            if len(manual_numbers)!=len(labels):raise ValueError(f'Manual label sequence changed on page {n}')
            for label,value in zip(labels,manual_numbers):label['number']={'value':value,'distance':0,'margin':1,'method':'visually_checked_source_label'}
        accepted=[]
        for index,label in enumerate(labels):
            y=label['bbox'][1]
            override=profile.get('labelOverridesByPosition',{}).get(f'{n}:{y}')
            if override:
                for field in ['number','exam']:
                    if field in override:label[field]={'value':override[field],'distance':0,'margin':1,'method':'visually_checked_source_label'}
            local_mode=mode
            for event_y,event in events:
                if event_y < y:local_mode=event
            if local_mode=='theory':
                excluded.append({'pdfPage':n,'bbox':label['bbox'],'reason':'Справочная рамка до начала блока упражнений.'})
                continue
            number=label.get('number',{})
            source_number=number.get('value')
            number_clear=source_number is not None and 1<=source_number<=150 and number.get('distance',1)<.10
            is_test=n<=9 or n>=419
            is_control=local_mode=='control' or bool(re.search('ТЕМАТИЧЕСКИЙ КОНТРОЛЬ',ocr[n]['text'][:300]))
            if label['kind']=='single' and not (is_test or is_control):
                excluded.append({'pdfPage':n,'bbox':label['bbox'],'reason':'Одиночная рамка вне контрольной: вероятно, справочная формула.'})
                continue
            if label['kind']=='double' and not number_clear and not re.search(r'Ответ|Определите|Каков|Найдите|Выберите',ocr[n]['text'],re.I):
                excluded.append({'pdfPage':n,'bbox':label['bbox'],'reason':'Не подтверждено, что рамка обозначает упражнение.'})
                continue
            exam=label.get('exam',{})
            exam_number=exam.get('value') if exam.get('distance',1)<.095 and exam.get('margin',0)>.002 else None
            if exam_number is not None and not 1<=exam_number<=26:exam_number=None
            if is_test:exam_number=source_number if number_clear and source_number<=26 else None
            kind='diagnostic' if n<=9 else 'final' if n>=419 else 'control' if label['kind']=='single' else 'typical'
            accepted.append((index,label,kind,source_number if number_clear else None,exam_number,number_clear))
        for position,(index,label,kind,source_number,exam_number,number_clear) in enumerate(accepted):
            start=max(110,label['bbox'][1]-12)
            end=accepted[position+1][1]['bbox'][1]-12 if position+1<len(accepted) else 1800
            for event_y,_ in events:
                if start+50<event_y<end:end=event_y-12
            if end-start<45:
                unresolved.append({'pdfPage':n,'reason':f'Слишком короткий фрагмент у метки y={start}'})
                continue
            text='\n'.join(line['text'].strip() for line in training.lines(ocr[n]) if start<=line['bbox']['y0']<end)
            key=f'p{n:03}-badge-y{label["bbox"][1]:04}'
            candidate=make_candidate(n,key,kind,source_number,exam_number,number_clear,[crop(n,[55,start,1235,end])],text)
            candidate['labelRecognition']=label
            local_group=current_group
            for event_y,event in events:
                if event_y<label['bbox'][1]:local_group=f'{event}-p{n:03}-y{event_y}'
            candidate['sourceGroup']=local_group
            candidate['controlNumber']=control_number if kind=='control' else None
            if manual_numbers or label.get('number',{}).get('method')=='visually_checked_source_label':candidate['numberStatus']='source_checked'
            candidate['review']['issues'].append('Привязка номера ЕГЭ взята только из печатной метки; соответствие актуальной спецификации требует проверки.')
            candidates.append(candidate)
        if events:
            mode=events[-1][1]
            current_group=f'{events[-1][1]}-p{n:03}-y{events[-1][0]}'

    # These cross-page continuations were checked against paired source scans.
    # Keep the continuation under the original ID instead of creating a new task.
    for n in profile.get('continuationPages',[]):
        previous_tasks=[question for question in candidates if question['fragments'][0]['pdfPage']==n-1]
        following_tasks=[question for question in candidates if question['fragments'][0]['pdfPage']==n]
        if not previous_tasks or not following_tasks:raise ValueError(f'Continuation anchor missing on page {n}')
        previous_task=max(previous_tasks,key=lambda question:question['fragments'][0]['bbox'][1])
        end=min(question['fragments'][0]['bbox'][1] for question in following_tasks)
        for y,_ in training.source_events(ocr[n]):
            if 115<y<end:end=y-12
        if end<190:raise ValueError(f'Continuation boundary changed on page {n}')
        previous_task['fragments'].append(crop(n,[55,115,1235,end]))
        text='\n'.join(line['text'].strip() for line in training.lines(ocr[n]) if 115<=line['bbox']['y0']<end)
        previous_task['ocrText']+='\n'+text
        previous_task['review']['issues'].append('Условие продолжается на следующей странице. Оба фрагмента сохранены под одним ID; требуется итоговая сверка полноты.')

    # Merge training conditions and their printed solutions by group + number.
    # Unreadable labels remain in a separate queue rather than guessed answers.
    training_rows=json.loads((directory/'training-rows.json').read_text())
    grouped=defaultdict(list)
    unclassified=[]
    for row in training_rows['rows']:
        file=directory/'training-labels'/row['labelCrop'].replace('.png','.json')
        recognized=json.loads(file.read_text()) if file.exists() else {'text':'','confidence':0}
        label_text=profile.get('trainingLabelOverrides',{}).get(row['id'],recognized['text'])
        if any(item['pdfPage']==row['pdfPage'] and item['range'][0]<=row['bbox'][1]<item['range'][1] for item in profile.get('nonExerciseRegions',[])):continue
        solution=bool(re.search('решени|ответ|обоснован',label_text,re.I))
        condition=not solution and bool(re.search('Зада[нв]|Задан|Задав',label_text,re.I))
        match=re.search(r'(?:№|Ne|No|N|задани[юяе])\s*([0-9]{1,2})',label_text,re.I)
        if not match:
            digits=re.findall(r'\b\d{1,2}\b',label_text)
            match_number=int(digits[-1]) if len(digits)==1 else None
        else:match_number=int(match.group(1))
        if not (solution or condition) or match_number is None:
            # Skip instructions, page headers, empty tails and grading rubrics.
            body=row['ocrText']
            if re.search(r'Перед выполнением|Прочитайте внимательно|Передвиньте листочек|Критерии|Баллы|максимально.*балл|Критерий',body,re.I):continue
            if row['bbox'][1]<200 and row['bbox'][3]-row['bbox'][1]<100:continue
            if len(re.sub(r'[^А-Яа-яA-Za-z0-9]','',re.sub(r'©[^\n]*','',body)))<35 or (body.strip().startswith('©') and len(body)<100):continue
            if re.search(r'№\s*$|^Задание\s*$',label_text,re.I) or not label_text.strip():continue
            unclassified.append({'pdfPage':row['pdfPage'],'bbox':row['bbox'],'text':label_text,'group':row['group']})
            continue
        row={**row,'role':'solution' if solution else 'condition','sourceNumber':match_number,'labelText':label_text}
        grouped[(row['group'],match_number)].append(row)
    for (group,number),rows in grouped.items():
        conditions=[row for row in rows if row['role']=='condition']
        if not conditions:
            unresolved.append({'pdfPage':rows[0]['pdfPage'],'reason':f'Есть разбор тренировочного задания {number}, но граница условия не выделена.'})
            continue
        first=conditions[0]
        fragments=[crop(row['pdfPage'],row['bbox'],row['role']) for row in rows]
        candidate=make_candidate(first['pdfPage'],f'{group}-task-{number}','training',number,None,True,fragments,'\n'.join(row['ocrText'] for row in conditions),chapter_by_id[first['chapter']])
        candidate['review']['issues'].append('Условие и исходный разбор связаны по группе таблицы и её номеру; связь требует визуальной сверки.')
        candidate['sourceGroup']=group
        candidates.append(candidate)

    # Reuse the eight source-checked records instead of duplicating the pilot.
    pilot_file=directory.parent/'pilot/manifest.json'
    pilot=json.loads(pilot_file.read_text())['questions'] if pilot_file.exists() else []
    pilot_matches=[]
    for checked in pilot:
        condition=next((asset for asset in checked['assets'] if asset['role']=='condition'),None)
        if not condition:continue
        n=condition['pdfPage'];y=condition['bbox'][1]
        # Source labels are Russian; distinguish the training plan explicitly.
        is_training='тренировочное' in checked['source']['taskLabel'].lower()
        matches=[candidate for candidate in candidates if (candidate['kind']=='training')==is_training and any(fragment['role']=='condition' and fragment['pdfPage']==n and abs(fragment['bbox'][1]-y)<65 for fragment in candidate['fragments'])]
        if len(matches)!=1:
            unresolved.append({'pdfPage':n,'reason':f'Проверенный пилот не удалось однозначно сопоставить: {checked["source"]["taskLabel"]}'})
            continue
        candidate=matches[0]
        candidate['pilotQuestionId']=checked['id'];candidate['answer']=checked['answer'];candidate['solution']=checked['solution']
        candidate['fragments']=[crop(n,condition['bbox'])]
        candidate['sourceExamNumber']=checked['examNumber'];candidate['numberStatus']='source_checked'
        candidate['review']={'status':'source_checked','issues':['Условие, рисунок и ответ сверены с PDF. Ожидает утверждения преподавателем и подтверждения прав.']}
        pilot_matches.append(checked['id'])

    # OCR answers remain a separate review field. They never replace verified
    # grading keys and ambiguous table-to-task matches are not silently chosen.
    cells_file=directory/'answer-cells.json'
    answer_cells=json.loads(cells_file.read_text())['cells'] if cells_file.exists() else []
    answer_index=defaultdict(list)
    for cell in answer_cells:
        number_file=directory/'answer-ocr'/cell['numberCrop'].replace('.png','.json')
        answer_file=directory/'answer-ocr'/cell['answerCrop'].replace('.png','.json')
        if not number_file.exists() or not answer_file.exists():continue
        number=json.loads(number_file.read_text());answer=json.loads(answer_file.read_text())
        if not re.fullmatch(r'\d{1,3}',number['text']) or not answer['text'].strip():continue
        source_number=int(number['text'])
        if not 1<=source_number<=150:continue
        section=cell['section']
        exams=section['examNumbers'] if section['kind']=='typical' else [None]
        for exam_number in exams:
            key=(section['kind'],cell['chapterId'] if section['kind'] not in ['diagnostic','final'] else 0,exam_number,section.get('controlNumber'),source_number)
            answer_index[key].append((cell,answer))
    for question in candidates:
        key=(question['kind'],question['chapterId'] if question['kind'] not in ['diagnostic','final'] else 0,
             question['sourceExamNumber'] if question['kind']=='typical' else None,
             question.get('controlNumber') if question['kind']=='control' else None,question['sourceExerciseNumber'])
        matches=answer_index.get(key,[])
        question['answerCandidate']=None
        if len(matches)==1:
            cell,answer=matches[0]
            fragment=crop(cell['pdfPage'],cell['bbox'],'context')
            question['answerCandidate']={'text':answer['text'],'confidence':answer['confidence'],'pdfPage':cell['pdfPage'],'asset':fragment['asset'],'status':'needs_review','sourceTable':cell['id']}
            if question['answer'] and question['answer']['type']=='numeric':
                try:
                    expected=float(question['answer']['expected'].replace(',','.'))
                    recognized=float(answer['text'].replace(',','.'))
                    if expected!=recognized:question['review']['issues'].append('OCR ячейки ответа отличается от сверенного эталона. Используется только сверенный эталон.')
                except ValueError:pass
        elif len(matches)>1:
            question['review']['issues'].append('Есть несколько возможных ячеек ответа; требуется ручное сопоставление.')

    solutions_file=directory/'solution-candidates.json'
    solution_records=json.loads(solutions_file.read_text())['solutions'] if solutions_file.exists() else []
    solution_index=defaultdict(list)
    for entry in solution_records:
        label_file=directory/'solution-labels'/entry['labelCrop'].replace('.png','.json')
        if not label_file.exists():continue
        label=json.loads(label_file.read_text())
        if entry['id'] in profile.get('solutionNumberOverrides',{}):label['text']=str(profile['solutionNumberOverrides'][entry['id']])
        if not re.fullmatch(r'\d{1,3}',label['text']):continue
        section=entry['section']
        for exam_number in section['examNumbers'] if section['kind']=='typical' else [None]:
            key=(section['kind'],entry['chapterId'] if section['kind'] not in ['diagnostic','final'] else 0,exam_number,section.get('controlNumber'),int(label['text']))
            solution_index[key].append(entry)
    for question in candidates:
        key=(question['kind'],question['chapterId'] if question['kind'] not in ['diagnostic','final'] else 0,
             question['sourceExamNumber'] if question['kind']=='typical' else None,
             question.get('controlNumber') if question['kind']=='control' else None,question['sourceExerciseNumber'])
        matches=solution_index.get(key,[])
        manual=[entry for entry in solution_records if profile.get('solutionTaskOverrides',{}).get(entry['id'])==question['id']]
        if manual:matches=manual
        question['solutionCandidate']=None
        if len(matches)==1:
            entry=matches[0]
            question['solutionCandidate']={'fragments':[crop(fragment['pdfPage'],fragment['bbox'][:3]+[1800] if fragment['bbox'][3]==1720 else fragment['bbox'],'solution') for fragment in entry['fragments']],'status':'needs_review','sourceLabel':entry['id']}

    # Full-page links preserve diagrams/continuations that still need segmentation.
    for n in range(4,425):
        text=ocr[n]['text']
        if n not in used_pages and n not in profile.get('referenceOnlyPages',[]) and re.search('Ответ[:;]|Определите|Найдите|Выберите все',text,re.I) and not re.search('СПРАВОЧНЫЕ МАТЕРИАЛЫ',text[:180]):
            unresolved.append({'pdfPage':n,'reason':'На странице есть признаки упражнений; границы требуют дополнительной разметки. Полный скан сохранён.'})
    unresolved.extend({'pdfPage':row['pdfPage'],'reason':'Не прочитана боковая подпись строки тренировочной таблицы.'} for row in unclassified)
    number_audit=[]
    numbering_groups=defaultdict(list)
    for question in candidates:numbering_groups[question['sourceGroup']].append(question)
    for group,records in numbering_groups.items():
        known=[question['sourceExerciseNumber'] for question in records if question['sourceExerciseNumber'] is not None]
        counts=Counter(known)
        duplicates=[number for number,count in counts.items() if count>1]
        gaps=[number for number in range(1,max(known,default=0)+1) if number not in counts]
        unreadable=[question for question in records if question['sourceExerciseNumber'] is None]
        if duplicates or gaps or unreadable:
            source_pages=sorted({question['fragments'][0]['pdfPage'] for question in records})
            number_audit.append({'group':group,'pages':source_pages,'duplicates':duplicates,'gaps':gaps,'unreadableIds':[question['id'] for question in unreadable]})
            for source_page in source_pages:unresolved.append({'pdfPage':source_page,'reason':'Последовательность печатных номеров требует сверки: пропуски, повторные или непрочитанные метки. Это не означает, что условие потеряно.'})
    # Visually checked boundaries can extend beyond the next left-margin badge:
    # diagrams in the right column sometimes overlap that vertical position.
    for question in candidates:
        overrides = profile.get('conditionFragmentOverrides', {}).get(question['id'])
        if overrides:
            question['fragments'] = [crop(fragment['pdfPage'], fragment['bbox']) for fragment in overrides] + [fragment for fragment in question['fragments'] if fragment['role'] != 'condition']
        solution_overrides = profile.get('solutionFragmentOverrides', {}).get(question['id'])
        if solution_overrides:
            question['solutionCandidate'] = {
                'fragments': [crop(fragment['pdfPage'], fragment['bbox'], 'solution') for fragment in solution_overrides],
                'status': 'needs_review',
                'sourceLabel': 'source-profile:' + question['id'],
            }
        question['review']['issues'].extend(profile.get('reviewIssuesById', {}).get(question['id'], []))
    # Persist source-bound visual reviews across every later import.
    reviews_file=directory/'review-ledger.json'
    review_errors=[]
    if reviews_file.exists():
        ledger=json.loads(reviews_file.read_text())
        if ledger.get('sourceId')!=source_hash:raise SystemExit('Review ledger belongs to a different PDF')
        by_id={question['id']:question for question in candidates}
        for entry in ledger.get('entries',[]):
            question=by_id.get(entry['questionId'])
            error=apply_review(question,entry) if question else 'Question no longer exists in this import.'
            if error:review_errors.append({'id':entry['questionId'],'error':error})
            elif entry.get('prompt'):
                question['verifiedFigures']=[crop(figure['pdfPage'],figure['bbox'],'context') for figure in entry.get('figures',[])]
        save_json(directory/'review-errors.json',{'errors':review_errors})
    source_checked=sum(question['review']['status']=='source_checked' for question in candidates)
    # Stable ordering and content versions make reimport idempotent.
    candidates.sort(key=lambda question:(question['fragments'][0]['pdfPage'],question['fragments'][0]['bbox'][1]))
    identifiers=[question['id'] for question in candidates]
    if len(identifiers)!=len(set(identifiers)):raise SystemExit('Duplicate stable IDs; refusing to write bank')
    stats={'added':0,'updated':0,'unchanged':0}
    for question in candidates:
        question['version']=digest(json.dumps(question,ensure_ascii=False,sort_keys=True).encode())[:16]
        old=previous.get(question['id'])
        stats['unchanged' if old and old['version']==question['version'] else 'updated' if old else 'added']+=1
    unresolved=list({(entry['pdfPage'],entry['reason']):entry for entry in unresolved}.values())
    summary={'detectedExercises':len(candidates),'sourceChecked':source_checked,'needsReview':len(candidates)-source_checked,
             'unknownNumbers':sum(question['sourceExamNumber'] is None for question in candidates),'trainingExercises':sum(question['kind']=='training' for question in candidates),
             'answerCandidates':sum(bool(question['answerCandidate']) for question in candidates),
             'solutionCandidates':sum(bool(question['solutionCandidate']) for question in candidates),
             'duplicateCount':0,'unresolvedPages':sorted(unresolved,key=lambda entry:entry['pdfPage']),
             'warnings':['Все материалы остаются локальными черновиками; Firebase и публикация не используются.',
                         f'Сверено со сканом: {source_checked} из {len(candidates)} записей. Осталось для проверки: {len(candidates)-source_checked}. Составные упражнения считаются одной записью.',
                         'Условия и рисунки сохранены сканами. Непроверенные ответы не включены в автопроверку.',
                         'Полные сканы всех 488 страниц, включая ответы и решения, доступны для проверки. Права на публикацию не подтверждены.'],
             'reimport':stats}
    manifest={'schemaVersion':2,'sourceId':source_hash,'title':json.loads(pilot_file.read_text())['title'] if pilot_file.exists() else profile.get('title',args.source.stem),'pages':pages,'questions':candidates,'assets':sorted(assets),'summary':summary}
    save_json(crop_index_file,crop_index)
    save_json(old_manifest,manifest)
    save_json(directory/'import-report.json',{'sourceId':source_hash,'pages':pages,'summary':summary,'byChapter':dict(Counter(question['chapter'] for question in candidates)),'byKind':dict(Counter(question['kind'] for question in candidates)),'excludedMarks':excluded,'unclassifiedTrainingRows':unclassified,'numberAudit':number_audit,'reviewErrors':review_errors,'published':0})
    for chapter in chapters:
        save_json(directory/f'chapter-{chapter["id"]:02}.json',{'sourceId':source_hash,'chapter':chapter,'questions':[question for question in candidates if question['chapterId']==chapter['id']]})
    save_json(directory/'checkpoint.json',{'sourceId':source_hash,'stage':'private_candidates_prepared','pagesPreserved':pages,'taskIds':identifiers,'unresolvedPages':summary['unresolvedPages'],'published':0})
    print(json.dumps({key:value for key,value in summary.items() if key not in ['unresolvedPages','warnings']},ensure_ascii=False))


if __name__=='__main__':main()
