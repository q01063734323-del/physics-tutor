import assert from "node:assert/strict";
import { assignmentAudience } from "../src/lib/assignment-access.ts";
const students = [{ id: "uid-a", email: "a@example.com" }, { id: "uid-b", email: "b@example.com" }];
assert.deepEqual(assignmentAudience("Все ученики", students), { audience: "class", assignedToId: null });
assert.deepEqual(assignmentAudience("b@example.com", students), { audience: "student", assignedToId: "uid-b" });
assert.throws(() => assignmentAudience("other@example.com", students));
assert.throws(() => assignmentAudience("uid-a", students));
console.log("Assignment recipient tests passed");
