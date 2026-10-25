import assert from 'node:assert/strict';
import { parseNumericAnswer, gradeNumericAnswer, gradeSequence, gradeMultiSelect, gradeMatching, gradeOrdering } from '../src/lib/grading.ts';
assert.equal(parseNumericAnswer(' 2,5 '), 2.5);
assert.equal(parseNumericAnswer('-3.2'), -3.2);
assert.equal(parseNumericAnswer('abc'), null);
assert.equal(gradeNumericAnswer('9,81', 9.8, { tolerance: 0.02 }).correct, true);
assert.equal(gradeNumericAnswer('9,81', 9.8, { tolerance: 0.005 }).correct, false);
assert.equal(gradeSequence('2 3 -4', [2, 3, -4]).correct, true);
assert.equal(gradeSequence('2; 3; 5', [2, 3, -4]).correct, false);
console.log('grading tests passed');

assert.equal(gradeMultiSelect([2, 0], [0, 2]).correct, true);
assert.equal(gradeMultiSelect([1], [0, 2]).correct, false);

assert.equal(gradeMatching({a:"1", b:"2"}, {a:"1", b:"2"}).correct, true);
assert.equal(gradeMatching({a:"2"}, {a:"1", b:"2"}).correct, false);
assert.equal(gradeOrdering(["А", "Б", "В"], ["А", "Б", "В"]).correct, true);
assert.equal(gradeOrdering(["Б", "А", "В"], ["А", "Б", "В"]).correct, false);
