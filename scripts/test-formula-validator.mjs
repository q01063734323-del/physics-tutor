import assert from "node:assert/strict";
import { normalizeFormula, validateFormula } from "../src/lib/formulaValidator.ts";

assert.equal(normalizeFormula(" I = U : R "), "i=u/r");
assert.equal(normalizeFormula("Q = c · m · Δt"), "q=c*m*dt");
assert.equal(validateFormula("i = u/r", "ohm").isValid, true);
assert.equal(validateFormula("U = R * I", "ohm").isValid, true);
assert.equal(validateFormula("F = a*m", "newton2").isValid, true);
assert.equal(validateFormula("I = U + R", "ohm").isValid, false);
assert.equal(validateFormula("I=U/R", "missing").isValid, false);
console.log("formula validator tests passed");
