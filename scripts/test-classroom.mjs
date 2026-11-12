import assert from "node:assert/strict";
import { classroomColors, isClassroomId, isClassroomStroke } from "../src/lib/classroom.ts";

const room = "123e4567-e89b-12d3-a456-426614174000";
assert.equal(isClassroomId(room), true);
assert.equal(isClassroomId("not-a-room"), false);
assert.equal(isClassroomStroke({ id: room, color: classroomColors[0].value, points: ["0.0,0.0", "1.0,1.0"] }), true);
assert.equal(isClassroomStroke({ id: room, color: "#fff", points: ["0.0,0.0", "1.0,1.0"] }), false);
assert.equal(isClassroomStroke({ id: room, color: classroomColors[0].value, points: ["0.0,0.0"] }), false);
console.log("classroom validation tests passed");
