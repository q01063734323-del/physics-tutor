export type NumericRule = { tolerance?: number; decimals?: number };

export function parseNumericAnswer(value: string): number | null {
  const normalized = value.trim().replace(/\s+/g, '').replace(',', '.');
  if (!normalized || !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(normalized)) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

export function gradeNumericAnswer(input: string, expected: number, rule: NumericRule = {}) {
  const actual = parseNumericAnswer(input);
  if (actual === null) return { correct: false, reason: 'Введите число, например 2,5 или -3.' };
  if (rule.decimals !== undefined) {
    const factor = 10 ** rule.decimals;
    if (Math.round(actual * factor) / factor !== actual) return { correct: false, reason: `Ответ должен содержать не более ${rule.decimals} знаков после запятой.` };
  }
  const tolerance = rule.tolerance ?? 0;
  return { correct: Math.abs(actual - expected) <= tolerance, actual, expected, tolerance };
}

export function gradeSequence(input: string, expected: number[], rule: NumericRule = {}) {
  const parts = input.split(/[;\s]+/).filter(Boolean);
  if (parts.length !== expected.length) return { correct: false, reason: `Нужно ввести ${expected.length} чисел.` };
  const results = parts.map((part, index) => gradeNumericAnswer(part, expected[index], rule));
  return { correct: results.every(result => result.correct), results };
}

export function gradeMultiSelect(selected: number[], expected: number[]) {
  const a = [...new Set(selected)].sort((x, y) => x - y);
  const b = [...new Set(expected)].sort((x, y) => x - y);
  return { correct: a.length === b.length && a.every((value, index) => value === b[index]), selected: a, expected: b };
}

export function gradeMatching(selected: Record<string, string>, expected: Record<string, string>) {
  const keys = Object.keys(expected);
  return { correct: keys.length === Object.keys(selected).length && keys.every(key => selected[key] === expected[key]) };
}

export function gradeOrdering(selected: string[], expected: string[]) {
  return { correct: selected.length === expected.length && selected.every((value, index) => value === expected[index]) };
}
