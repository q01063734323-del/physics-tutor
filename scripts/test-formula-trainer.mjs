import assert from "node:assert/strict";
import { applyFormulaAnswer, createFormulaAttempt } from "../src/lib/formulaTrainer.ts";

let state = createFormulaAttempt();
state = applyFormulaAnswer(state, false);
assert.equal(state.showHint, false);
state = applyFormulaAnswer(state, false);
assert.equal(state.showHint, true);
state = applyFormulaAnswer(state, false);
assert.equal(state.revealAnswer, true);
state = applyFormulaAnswer(state, true);
assert.equal(state.solved, true);
console.log("formula trainer tests passed");
