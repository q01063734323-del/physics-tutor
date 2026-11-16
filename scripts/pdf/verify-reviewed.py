"""Verify source-bound reviews and pixel-exact source crops, without publishing."""
import argparse
import json
from pathlib import Path
from PIL import Image, ImageChops
from review_contract import apply_review


def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--directory',type=Path,default=Path('.local/pdf-imports/full'))
    args=parser.parse_args()
    directory=args.directory.resolve()
    if not directory.is_relative_to(Path.cwd().resolve()/'.local/pdf-imports'):
        raise SystemExit('Only private PDF import directories are supported.')
    bank=json.loads((directory/'manifest.json').read_text())
    ledger=json.loads((directory/'review-ledger.json').read_text())
    if ledger['sourceId']!=bank['sourceId']:raise ValueError('Mismatched source document.')
    by_id={question['id']:question for question in bank['questions']}
    for entry in ledger['entries']:
        question=json.loads(json.dumps(by_id[entry['questionId']]))
        error=apply_review(question,entry)
        if error:raise ValueError(f"{question['id']}: {error}")
    checked=[question for question in bank['questions'] if question['review']['status']=='source_checked']
    fragments={}
    for question in checked:
        assert question['rights']=='unknown'
        for fragment in question['fragments']+question.get('verifiedFigures',[])+question.get('verifiedSolutionFragments',[]):
            fragments[(fragment['pdfPage'],tuple(fragment['bbox']),fragment['asset'])]=fragment
    for fragment in fragments.values():
        with Image.open(directory/'source-pages'/f"page-{fragment['pdfPage']:03}.png") as page, Image.open(directory/'assets'/fragment['asset']) as crop:
            expected=page.crop(fragment['bbox']).convert('RGB')
            if expected.size!=crop.size or ImageChops.difference(expected,crop.convert('RGB')).getbbox():
                raise ValueError(f"Altered source pixels: {fragment['asset']}")
    assert len(checked)==bank['summary']['sourceChecked']
    report={'sourceId':bank['sourceId'],'verifiedQuestions':len(checked),'sourceBoundReviews':len(ledger['entries']),'pixelExactFragments':len(fragments),'published':0}
    (directory/'verification-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps(report,ensure_ascii=False))


if __name__=='__main__':main()
