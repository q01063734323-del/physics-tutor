"""Build the reviewed formula registry and coverage report; no Firebase/network."""
import hashlib
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / 'data/blitz'
ARCHIVE = 'https://doc.fipi.ru/ege/demoversii-specifikacii-kodifikatory/2027/fi_11_2027.zip'
GROUPS = {
    '1.1': ('Механика', 'Кинематика'), '1.2': ('Механика', 'Динамика'),
    '1.3': ('Механика', 'Статика и гидростатика'), '1.4': ('Механика', 'Импульс, работа и энергия'),
    '1.5': ('Механика', 'Механические колебания и волны'),
    '2.1': ('Молекулярная физика и термодинамика', 'МКТ и идеальный газ'),
    '2.2': ('Молекулярная физика и термодинамика', 'Термодинамика'),
    '3.1': ('Электродинамика', 'Электростатика и конденсаторы'),
    '3.2': ('Электродинамика', 'Постоянный ток'), '3.3': ('Электродинамика', 'Магнитное поле'),
    '3.4': ('Электродинамика', 'Электромагнитная индукция'),
    '3.5': ('Электродинамика', 'Электромагнитные колебания и волны'),
    '3.6': ('Оптика', 'Геометрическая и волновая оптика'),
    '4.1': ('Квантовая физика', 'Фотоны и фотоэффект'),
    '4.2': ('Квантовая физика', 'Физика атома'), '4.3': ('Квантовая физика', 'Ядерная физика'),
}
BASE = ['kg', 'm', 's', 'A', 'K', 'mol', 'cd']
PAGE_OVERRIDES = {'accelerated-displacement': 8, 'average-unidirectional': 8,
                  'spring-period': 11, 'pendulum-angular': 11, 'spring-angular': 11,
                  'conductor-potential': 14, 'joule-lenz': 15, 'joule-voltage': 15,
                  'resistor-heat-product': 15, 'interference-max': 18, 'interference-min': 18,
                  'beta-plus': 19}


def rows(name, columns):
    result = []
    for number, line in enumerate((DATA / name).read_text().splitlines(), 1):
        if not line.strip() or line.startswith('#'):
            continue
        parts = line.split('|')
        if len(parts) != columns:
            raise ValueError(f'{name}:{number}: expected {columns} columns, got {len(parts)}')
        result.append(parts)
    return result


def dimension(expression):
    values = dict.fromkeys(BASE, 0)
    for index, part in enumerate(expression.split('/')):
        for token in part.split('*'):
            if token == '1':
                continue
            unit, _, power = token.partition('^')
            if unit not in values:
                raise ValueError(f'Unknown base unit {unit}')
            values[unit] += (int(power) if power else 1) * (1 if index == 0 else -1)
    return [values[unit] for unit in BASE]


def main():
    source = json.loads((DATA / 'codifier.json').read_text())
    by_code = {item['code']: item for item in source['elements']}
    quantities = []
    for id_, name, symbol, unit, base, mistake in rows('quantities.tsv', 6):
        quantities.append(dict(id=id_, name=name, symbol=symbol, unit=unit, baseSI=base,
                               dimension=dimension(base), mistake=mistake, relatedFormulas=[],
                               source='https://www.bipm.org/en/publications/si-brochure'))
    quantity_map = {item['id']: item for item in quantities}
    formulas = []
    for id_, code, title, latex, variables, conditions, difficulty, kind, base in rows('formulas.tsv', 9):
        if code not in by_code:
            raise ValueError(f'Unknown FIPI code {code}')
        section, topic = GROUPS[code.rsplit('.', 1)[0]]
        variable_list = []
        for variable in variables.split(','):
            symbol, quantity = variable.split(':')
            if quantity not in quantity_map:
                raise ValueError(f'{id_}: unknown quantity {quantity}')
            item = quantity_map[quantity]
            variable_list.append(dict(symbol=symbol, quantityId=quantity, name=item['name'], unit=item['unit']))
            item['relatedFormulas'].append(id_)
        formulas.append(dict(id=id_, code=code, section=section, topic=topic, title=title,
                             latex=latex, variables=variable_list, conditions=conditions,
                             difficulty=int(difficulty), kind=kind, related=[base] if base else [],
                             source=dict(url=ARCHIVE, document='demo-reference' if kind == 'provided' else 'codifier',
                                         printedPage=4 if kind == 'provided' else PAGE_OVERRIDES.get(id_, by_code[code]['printedPage']),
                                         status='derived' if kind == 'derive' else 'explicit'),
                             provided=kind == 'provided', mistake=quantity_map[variable_list[0]['quantityId']]['mistake']))
    concepts = []
    for code, id_, prompt, correct, wrong1, wrong2, wrong3, explanation in rows('concepts.tsv', 8):
        section, topic = GROUPS[code.rsplit('.', 1)[0]]
        concepts.append(dict(id=id_, code=code, section=section, topic=topic, prompt=prompt,
                             correct=correct, distractors=[wrong1, wrong2, wrong3], explanation=explanation,
                             source=dict(url=ARCHIVE, document='codifier', printedPage=by_code[code]['printedPage'])))
    formula_map = {f['id']: f for f in formulas}
    # Keep an explicit derivation first; add nearby laws and reverse derivations.
    for formula in formulas:
        nearby = [other['id'] for other in formulas if other['id'] != formula['id'] and
                  (other['code'] == formula['code'] or formula['id'] in other['related'])]
        formula['related'] = list(dict.fromkeys(formula['related'] + nearby))
    gaps = []
    for element in source['elements']:
        missing = [id_ for id_ in element['requiredFormulas'] if id_ not in formula_map]
        if missing or not any(f['code'] == element['code'] for f in formulas) and not any(c['code'] == element['code'] for c in concepts):
            gaps.append(dict(code=element['code'], missing=missing))
    if len(formula_map) != len(formulas) or gaps:
        raise ValueError(f'Duplicate formulas or coverage gaps: {gaps}')
    for formula in formulas:
        if any(id_ not in formula_map for id_ in formula['related']):
            raise ValueError(f'Unknown related formula: {formula["id"]}')
    payload = dict(schemaVersion=1, year=2027, source=source, groups=[dict(code=k, section=v[0], topic=v[1]) for k, v in GROUPS.items()],
                   formulas=formulas, quantities=quantities, concepts=concepts)
    encoded = json.dumps(payload, ensure_ascii=False, separators=(',', ':'))
    payload['version'] = hashlib.sha256(encoded.encode()).hexdigest()[:16]
    (DATA / 'catalog.json').write_text(json.dumps(payload, ensure_ascii=False, indent=2) + '\n')
    lines = ['# FORMULA_COVERAGE — ЕГЭ по физике 2027', '',
             'Проверка: 18 ноября 2026. Основа — таблица 3 кодификатора ФИПИ, печатные страницы 7–19; справочные данные демоверсии — страница 4.', '',
             f'Официальный архив: {ARCHIVE}', 'Страница ФИПИ: https://fipi.ru/ege/demoversii-specifikacii-kodifikatory',
             'Единицы СИ: https://www.bipm.org/en/publications/si-brochure', '',
             f'Учтено {len(source["elements"])} пунктов содержания. Реестр: **{len(formulas)} записей**, включая законы, применимые формы и явно отмеченные выводимые преобразования; это не число независимых законов.',
             f'Величин СИ: {len(quantities)}. Качественных вопросов: {len(concepts)}. Автоматически обнаруженных пробелов привязки: {len(gaps)}.', '',
             'Визуально просмотрены все страницы перечня содержания. Автоматическая проверка фиксирует соответствие 127 пунктам и сохранение обязательных формул; она не заменяет независимую физическую экспертизу каждого нового производного выражения.', '',
             '## Что выдаётся на экзамене', '',
             'Справочные материалы содержат приставки, константы, характеристики частиц и веществ, перевод шкал температуры, электронвольта и атомной единицы массы. Общего листа основных формул механики, термодинамики, цепей и оптики в просмотренной демоверсии нет.', '']
    lines += [f'- `{f["id"]}` — {f["title"]}: `${f["latex"]}$.' for f in formulas if f['provided']]
    lines += ['', 'Все остальные записи помечены «знать» (явное соотношение кодификатора) или «вывести/применить». Производные выражения не выдаются за дословные формулы ФИПИ.', '', '## Покрытие по пунктам', '', '| Код | Проверяемое содержание | Формулы | Качественные вопросы |', '| --- | --- | --- | --- |']
    for element in source['elements']:
        formulas_here = [f'`{f["id"]}`' for f in formulas if f['code'] == element['code']]
        concepts_here = [f'`{c["id"]}`' for c in concepts if c['code'] == element['code']]
        lines.append(f'| {element["code"]} | {element["title"]} | {", ".join(formulas_here) or "Не требуется отдельная формула"} | {", ".join(concepts_here) or "—"} |')
    for group, (section, topic) in GROUPS.items():
        lines += ['', f'## {section} — {topic}', '']
        for formula in formulas:
            if formula['code'].rsplit('.', 1)[0] == group:
                label = 'справочные данные' if formula['provided'] else 'вывести/применить' if formula['kind'] == 'derive' else 'знать'
                lines.append(f'- **{formula["title"]}** (`{formula["id"]}`, {formula["code"]}, {label}): `${formula["latex"]}$ — {formula["conditions"]}')
    lines += ['', '## Границы покрытия', '',
              '- Качественные явления покрыты отдельными вопросами, а не фиктивными формулами.',
              '- Оптика в официальном кодификаторе находится в разделе 3.6 электродинамики; в интерфейсе выделена для удобства.',
              '- Микроскоп, телескоп и формулы вне просмотренного перечня не объявляются обязательными требованиями ФИПИ.',
              '- Экспериментальные навыки из требований к результатам не заменяются запоминанием формул; тренажёр не заменяет лабораторную практику и решение развёрнутых задач.',
              '- Изменения будущих редакций ФИПИ требуют новой сверки; версия и хеш исходного архива зафиксированы в data/blitz/codifier.json.',
              '- Общая отметка покрытия относится к реестру, а не к завершённости интерфейса или тестированию на реальных телефонах.', '']
    (ROOT / 'FORMULA_COVERAGE.md').write_text('\n'.join(lines))
    print(f'Blitz catalog: {len(formulas)} formulas, {len(quantities)} quantities, {len(concepts)} concepts; {len(source["elements"])} codes; gaps={len(gaps)}')


if __name__ == '__main__':
    main()
