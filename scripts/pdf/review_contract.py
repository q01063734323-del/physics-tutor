"""Source-bound verification records. Reviews never grant publication rights."""
import hashlib
import json
import math


def source_fingerprint(question):
    value = {
        'id': question['id'],
        'conditions': [fragment for fragment in question['fragments'] if fragment['role'] == 'condition'],
        'sourceNumber': question['sourceExerciseNumber'],
        'sourceExamNumber': question['sourceExamNumber'],
        'group': question.get('sourceGroup'),
        'answerCell': question.get('answerCandidate', {}).get('asset') if question.get('answerCandidate') else None,
    }
    return hashlib.sha256(json.dumps(value, ensure_ascii=False, sort_keys=True).encode()).hexdigest()


def valid_answer(answer):
    if not isinstance(answer, dict): return False
    if answer.get('type') == 'numeric':
        try: return bool(str(answer['expected']).strip()) and math.isfinite(float(str(answer['expected']).replace(',', '.')))
        except (KeyError, TypeError, ValueError): return False
    if answer.get('type') == 'sequence':
        return isinstance(answer.get('expected'), list) and 0 < len(answer['expected']) <= 20 and all(isinstance(value, str) and value.strip() for value in answer['expected'])
    if answer.get('type') == 'multi_select':
        values = answer.get('expected')
        return isinstance(values, list) and bool(values) and all(type(value) is int and 1 <= value <= 9 for value in values) and len(set(values)) == len(values)
    if answer.get('type') == 'manual':
        return isinstance(answer.get('expected'), str) and bool(answer['expected'].strip())
    return False


def solution_fragments(question):
    return [fragment for fragment in question['fragments'] if fragment['role'] == 'solution'] + (question.get('solutionCandidate') or {}).get('fragments', [])


def solution_fingerprint(question):
    return hashlib.sha256(json.dumps(solution_fragments(question), ensure_ascii=False, sort_keys=True).encode()).hexdigest()


def apply_review(question, entry):
    if entry.get('sourceFingerprint') != source_fingerprint(question):
        return 'Source changed after verification; review must be repeated.'
    checks = entry.get('checks', {})
    required = ['conditionComplete', 'figuresChecked', 'mathChecked', 'numberChecked', 'answerChecked']
    if not all(checks.get(key) is True for key in required):
        return 'Full verification checklist is incomplete.'
    evidence = entry.get('evidence', {})
    condition_pages = {fragment['pdfPage'] for fragment in question['fragments'] if fragment['role'] == 'condition'}
    if set(evidence.get('conditionPages', [])) != condition_pages or not isinstance(evidence.get('answerPage'), int) or not evidence.get('note'):
        return 'Missing source evidence for condition or answer.'
    if not valid_answer(entry.get('answer')):
        return 'Invalid verified answer.'
    if entry.get('solutionChecked'):
        fragments = solution_fragments(question)
        if not fragments or entry.get('solutionFingerprint') != solution_fingerprint(question) or set(evidence.get('solutionPages', [])) != {fragment['pdfPage'] for fragment in fragments}:
            return 'Missing or stale source evidence for verified solution.'
        question['verifiedSolutionFragments'] = fragments
    question['answer'] = entry['answer']
    question['review'] = {'status': 'source_checked', 'issues': ['Условие, рисунки, формулы в оригинальном скане, печатный номер и ответ сверены с PDF. Ожидает утверждения преподавателем и подтверждения прав.'], 'evidence': evidence, 'checkedAt': entry.get('checkedAt')}
    question['numberStatus'] = 'source_checked'
    question['verifiedRepresentation'] = 'transcribed' if entry.get('prompt') else 'source_scan'
    if entry.get('prompt'): question['verifiedPrompt'] = entry['prompt']
    # No license, teacher approval or fabricated solution is added by this review.
    return None
