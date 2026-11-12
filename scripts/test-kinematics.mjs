import assert from "node:assert/strict";
import { compareSeries, deriveAll, directionChanges, displacement, derivative, generateEgeTasks, pathLength, stoppingTimes } from "../src/lib/kinematics.ts";

const position = [{ t: 0, value: 0 }, { t: 2, value: 4 }, { t: 4, value: 4 }, { t: 6, value: 0 }];
const allFromX = deriveAll("x", position, { x0: 0, v0: 0 });
assert.deepEqual(allFromX.v.map(point => point.value), [2, 1, -1, -2]);
assert.equal(displacement(allFromX.v), 0);
assert.equal(pathLength(allFromX.v), 8);
assert.deepEqual(stoppingTimes(allFromX.v), [3]);
assert.deepEqual(directionChanges(allFromX.v), []);

const velocity = [{ t: 0, value: -2 }, { t: 2, value: 2 }, { t: 4, value: 2 }];
assert.deepEqual(derivative(velocity).map(point => point.value), [2, 1, 0]);
assert.deepEqual(stoppingTimes(velocity), [1]);
assert.equal(displacement(velocity), 4);
assert.equal(pathLength(velocity), 8);

const acceleration = [{ t: 0, value: 2 }, { t: 3, value: 2 }];
const allFromA = deriveAll("a", acceleration, { x0: 1, v0: 0 });
assert.deepEqual(allFromA.v.map(point => point.value), [0, 6]);
assert.deepEqual(allFromA.x.map(point => point.value), [1, 10]);
assert.equal(compareSeries(allFromA.v, [{ t: 0, value: 0 }, { t: 3, value: 6 }]).correct, true);
assert.equal(generateEgeTasks(12, 3).length, 12);
console.log("kinematics tests passed");
